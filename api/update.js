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
  const signalUpdates = new Map()  // name -> row (state o'zgarishi)
  const voltageUpdates = new Map() // name -> row (faqat kuchlanish, state'ga tegmaydi)
  const rejected = []

  function apply(nm, st, device) {
    signalUpdates.set(nm, { name: nm, state: st, device: device || null, updated_at: new Date().toISOString() })
  }

  function applyVoltage(nm, voltage, device) {
    voltageUpdates.set(nm, { name: nm, voltage, device: device || null, updated_at: new Date().toISOString() })
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

  // 4) Kuchlanish xaritasi: { voltages: { "1СП": 218.4, "IП": 219.5 } } —
  // 'state'ga tegmaydi, shuning uchun alohida (boshqa ustunlar bilan) upsert
  // qilinadi — aks holda bitta so'rovda turli ustunli qatorlar aralashib ketardi.
  if (data.voltages && typeof data.voltages === 'object') {
    Object.entries(data.voltages).forEach(([k, v]) => {
      const num = Number(v)
      const nm = normalizeSignalName(k)
      if (!Number.isFinite(num)) { rejected.push(`${nm}: "${v}" (kuchlanish)`); return }
      applyVoltage(nm, num, topDevice)
    })
  }

  if (!signalUpdates.size && !voltageUpdates.size) {
    res.status(400).json({ ok: false, error: "Hech narsa qabul qilinmadi", rejected, kelganKalitlar: Object.keys(data) })
    return
  }

  // Arxivga yozish (haqiqiy state o'zgarganda) Postgres trigger orqali
  // avtomatik bajariladi (supabase/schema.sql: log_signal_change). Kuchlanish
  // yangilanishi 'state'ga tegmagani uchun arxivni to'ldirmaydi.
  if (signalUpdates.size) {
    const { error } = await supabase.from('signals').upsert([...signalUpdates.values()], { onConflict: 'name' })
    if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  }
  if (voltageUpdates.size) {
    const { error } = await supabase.from('signals').upsert([...voltageUpdates.values()], { onConflict: 'name' })
    if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  }

  res.status(200).json({ ok: true, count: signalUpdates.size + voltageUpdates.size, rejected })
}
