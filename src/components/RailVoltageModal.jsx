import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { normalizeSignalName } from '../utils/signalNames'

// Monosxemadagi 9 ta asosiy seksiya (Monosxema.jsx SECTIONS bilan bir xil) —
// hali sensor ma'lumoti kelmagan seksiyalar ham ro'yxatda "—" bilan ko'rinsin.
const SECTION_NAMES = [
  '1ЧП', '2СП', 'IП', '1СП', '1НП',
  '4-6СП', 'IIП', '3-5СП', 'IVП'
].map(normalizeSignalName)

function fmt(v) {
  return typeof v === 'number' ? `${v.toFixed(1)}V` : '—'
}

function fmtTime(t) {
  if (!t) return '—'
  return new Date(t).toLocaleTimeString('uz-UZ')
}

export default function RailVoltageModal() {
  const [rows, setRows] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    let disposed = false

    async function load() {
      const { data, error } = await supabase.from('rail_voltages').select('*')
      if (disposed) return
      if (error) { setError(error.message); return }
      const map = {}
      ;(data || []).forEach(r => { map[normalizeSignalName(r.name)] = r })
      setRows(map)
      setError(null)
    }

    load()

    const channel = supabase
      .channel('rail-voltage-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rail_voltages' }, (payload) => {
        const row = payload.new
        if (!row) return
        setRows(prev => ({ ...prev, [normalizeSignalName(row.name)]: row }))
      })
      .subscribe()

    const pollTimer = setInterval(load, 2000)

    return () => {
      disposed = true
      supabase.removeChannel(channel)
      clearInterval(pollTimer)
    }
  }, [])

  return (
    <div className="overflow-x-auto">
      {error && <p className="text-danger mb-2">{error}</p>}
      <table className="w-full border-collapse text-sky2 text-[0.92rem]">
        <thead>
          <tr className="border-b border-line">
            <th className="text-left p-2 text-muted2 text-[0.74rem] uppercase tracking-[0.1em]">Seksiya</th>
            <th className="text-left p-2 text-muted2 text-[0.74rem] uppercase tracking-[0.1em]">Quvvat tomoni</th>
            <th className="text-left p-2 text-muted2 text-[0.74rem] uppercase tracking-[0.1em]">Rele tomoni</th>
            <th className="text-left p-2 text-muted2 text-[0.74rem] uppercase tracking-[0.1em]">Vaqt</th>
          </tr>
        </thead>
        <tbody>
          {SECTION_NAMES.map(name => {
            const r = rows[name]
            return (
              <tr key={name} className="border-b border-line">
                <td className="p-2 font-semibold">{name}</td>
                <td className="p-2 font-mono">{fmt(r?.power_voltage)}</td>
                <td className="p-2 font-mono">{fmt(r?.relay_voltage)}</td>
                <td className="p-2 font-mono text-muted text-[0.85rem]">{fmtTime(r?.updated_at)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
