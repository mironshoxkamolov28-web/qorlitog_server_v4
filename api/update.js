import { createClient } from '@supabase/supabase-js'
import { normalizeSignalName } from '../src/utils/signalNames.js'
import { parseStateValue, NAME_KEYS, STATE_KEYS, pick } from '../src/utils/signalParsing.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST kerak' }); return }

  const data = req.body
  if (!data || typeof data !== 'object') {
    res.status(400).json({ ok: false, error: "Format tanilmadi. JSON yuboring, masalan: {\"name\":\"2СП\",\"state\":\"green\"}" })
    return
  }

  const { data: currentRows, error: fetchErr } = await supabase.from('signals').select('name, state')
  if (fetchErr) {
    res.status(500).json({ ok: false, error: fetchErr.message })
    return
  }
  const current = Object.fromEntries((currentRows || []).map(r => [r.name, r.state]))

  const topDevice = data.device
  const signalUpdates = new Map() // name -> row
  const archiveInserts = []
  const rejected = []
  let recognized = 0

  function apply(nm, st, device, ts) {
    signalUpdates.set(nm, { name: nm, state: st, device: device || null, updated_at: new Date().toISOString() })
    recognized++
    if (current[nm] !== st) {
      archiveInserts.push({ name: nm, state: st, device: device || null, ts: ts || Date.now() })
      current[nm] = st
    }
  }

  // 1) To'liq xarita: { signals: { "Ч1": "green", ... } } — heartbeat
  if (data.signals && typeof data.signals === 'object') {
    Object.entries(data.signals).forEach(([k, v]) => {
      const st = parseStateValue(v)
      const nm = normalizeSignalName(k)
      if (!st) { rejected.push(`${nm}: "${v}"`); return }
      apply(nm, st, topDevice)
    })
  }

  // 2) Hodisalar ro'yxati: { events: [ { name, state }, ... ] }
  if (data.events && Array.isArray(data.events)) {
    data.events.forEach(ev => {
      if (!ev) return
      const rawName = pick(ev, NAME_KEYS)
      const st = parseStateValue(pick(ev, STATE_KEYS))
      if (!rawName || !st) { rejected.push(JSON.stringify(ev).slice(0, 80)); return }
      apply(normalizeSignalName(rawName), st, ev.device || topDevice, ev.ts)
    })
  }

  // 3) Bitta signal: { name, state }
  const rawName = pick(data, NAME_KEYS)
  if (rawName !== undefined) {
    const st = parseStateValue(pick(data, STATE_KEYS))
    if (st) {
      apply(normalizeSignalName(rawName), st, topDevice, data.ts)
    } else {
      rejected.push(`${rawName}: "${pick(data, STATE_KEYS)}"`)
    }
  }

  if (signalUpdates.size) {
    const { error: upsertErr } = await supabase.from('signals').upsert([...signalUpdates.values()], { onConflict: 'name' })
    if (upsertErr) { res.status(500).json({ ok: false, error: upsertErr.message }); return }
  }
  if (archiveInserts.length) {
    const { error: insertErr } = await supabase.from('archive').insert(archiveInserts)
    if (insertErr) { res.status(500).json({ ok: false, error: insertErr.message }); return }
  }

  const ok = recognized > 0
  res.status(ok ? 200 : 400).json(
    ok
      ? { ok: true, applied: archiveInserts.map(a => `${a.name}→${a.state}`), unchanged: recognized - archiveInserts.length }
      : { ok: false, error: "Hech narsa qabul qilinmadi", rejected, kelganKalitlar: Object.keys(data) }
  )
}
