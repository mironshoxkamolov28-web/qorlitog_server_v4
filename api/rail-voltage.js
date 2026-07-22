import { createClient } from '@supabase/supabase-js'
import { normalizeSignalName } from '../src/utils/signalNames.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Kutilgan format:
// { "device": "esp32-3", "voltages": { "1ЧП": { "power": 218.4, "relay": 12.1 }, ... } }
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST kerak' }); return }

  const data = req.body
  if (!data || typeof data !== 'object' || !data.voltages || typeof data.voltages !== 'object') {
    res.status(400).json({
      ok: false,
      error: 'Format: { "device": "esp32-3", "voltages": { "1ЧП": { "power": 218.4, "relay": 12.1 } } }'
    })
    return
  }

  const device = data.device || null
  const rows = []
  const rejected = []

  Object.entries(data.voltages).forEach(([rawName, v]) => {
    const name = normalizeSignalName(rawName)
    const power = Number(v?.power)
    const relay = Number(v?.relay)
    if (!Number.isFinite(power) && !Number.isFinite(relay)) {
      rejected.push(`${name}: power/relay noto'g'ri`)
      return
    }
    rows.push({
      name,
      power_voltage: Number.isFinite(power) ? power : null,
      relay_voltage: Number.isFinite(relay) ? relay : null,
      device,
      updated_at: new Date().toISOString()
    })
  })

  if (!rows.length) {
    res.status(400).json({ ok: false, error: 'Hech narsa qabul qilinmadi', rejected })
    return
  }

  const { error } = await supabase.from('rail_voltages').upsert(rows, { onConflict: 'name' })
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }

  res.status(200).json({ ok: true, count: rows.length, rejected })
}
