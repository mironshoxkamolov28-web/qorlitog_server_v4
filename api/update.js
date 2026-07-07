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

  const topDevice = data.device
  const signalUpdates = new Map() // name -> row
  const rejected = []

  function apply(nm, st, device) {
    signalUpdates.set(nm, { name: nm, state: st, device: device || null, updated_at: new Date().toISOString() })
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
      apply(normalizeSignalName(rawName), st, ev.device || topDevice)
    })
  }

  // 3) Bitta signal: { name, state }
  const rawName = pick(data, NAME_KEYS)
  if (rawName !== undefined) {
    const st = parseStateValue(pick(data, STATE_KEYS))
    if (st) {
      apply(normalizeSignalName(rawName), st, topDevice)
    } else {
      rejected.push(`${rawName}: "${pick(data, STATE_KEYS)}"`)
    }
  }

  if (!signalUpdates.size) {
    res.status(400).json({ ok: false, error: "Hech narsa qabul qilinmadi", rejected, kelganKalitlar: Object.keys(data) })
    return
  }

  // Bitta upsert — arxivga yozish (haqiqiy o'zgarganda) Postgres trigger orqali
  // avtomatik bajariladi (supabase/schema.sql: log_signal_change).
  const { error: upsertErr } = await supabase.from('signals').upsert([...signalUpdates.values()], { onConflict: 'name' })
  if (upsertErr) { res.status(500).json({ ok: false, error: upsertErr.message }); return }

  res.status(200).json({ ok: true, count: signalUpdates.size, rejected })
}
