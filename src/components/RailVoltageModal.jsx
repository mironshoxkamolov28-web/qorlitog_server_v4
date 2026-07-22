import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { normalizeSignalName } from '../utils/signalNames'

// Monosxemadagi 9 ta asosiy seksiya (Monosxema.jsx SECTIONS bilan bir xil) —
// hali sensor ma'lumoti kelmagan seksiyalar ham ro'yxatda "—" bilan ko'rinsin.
const SECTION_NAMES = [
  '1ЧП', '2СП', 'IП', '1СП', '1НП',
  '4-6СП', 'IIП', '3-5СП', 'IVП'
].map(normalizeSignalName)

// Quvvat tomoni: barcha seksiyalarda bir xil chegara (schema.sql'dagi
// log_voltage_alarm() trigger'idagi qiymatlar bilan mos bo'lishi kerak).
const POWER_HIGH = 235
const POWER_LOW = 185

const EVENT_LABELS = {
  high_start: 'Yuqori kuchlanish boshlandi',
  high_end:   'Yuqori kuchlanish tugadi',
  low_start:  'Past kuchlanish boshlandi',
  low_end:    'Past kuchlanish tugadi',
}
const SIDE_LABELS = { power: 'Quvvat', relay: 'Rele' }

function fmt(v) {
  return typeof v === 'number' ? `${v.toFixed(1)}V` : '—'
}

function fmtTime(t) {
  if (!t) return '—'
  return new Date(t).toLocaleTimeString('uz-UZ')
}

function isAlarm(value, low, high) {
  if (typeof value !== 'number') return false
  if (typeof high === 'number' && value > high) return true
  if (typeof low === 'number' && value < low) return true
  return false
}

export default function RailVoltageModal() {
  const [rows, setRows] = useState({})
  const [limits, setLimits] = useState({})
  const [alarms, setAlarms] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let disposed = false

    async function load() {
      const [{ data: voltData, error: voltErr }, { data: limitData, error: limitErr }] = await Promise.all([
        supabase.from('rail_voltages').select('*'),
        supabase.from('rail_voltage_limits').select('*'),
      ])
      if (disposed) return
      if (voltErr) { setError(voltErr.message); return }
      const map = {}
      ;(voltData || []).forEach(r => { map[normalizeSignalName(r.name)] = r })
      setRows(map)
      if (!limitErr) {
        const lmap = {}
        ;(limitData || []).forEach(l => { lmap[normalizeSignalName(l.name)] = l })
        setLimits(lmap)
      }
      setError(null)
    }

    async function loadAlarms() {
      const { data } = await supabase
        .from('rail_voltage_archive')
        .select('*')
        .order('ts', { ascending: false })
        .limit(50)
      if (disposed) return
      if (data) setAlarms(data)
    }

    load()
    loadAlarms()

    const channel = supabase
      .channel('rail-voltage-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rail_voltages' }, (payload) => {
        const row = payload.new
        if (!row) return
        setRows(prev => ({ ...prev, [normalizeSignalName(row.name)]: row }))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rail_voltage_archive' }, (payload) => {
        const row = payload.new
        if (!row) return
        setAlarms(prev => [row, ...prev].slice(0, 50))
      })
      .subscribe()

    const pollTimer = setInterval(() => { load(); loadAlarms() }, 2000)

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
            const lim = limits[name]
            const powerAlarm = isAlarm(r?.power_voltage, POWER_LOW, POWER_HIGH)
            const relayAlarm = isAlarm(r?.relay_voltage, lim?.relay_low, lim?.relay_high)
            return (
              <tr key={name} className="border-b border-line">
                <td className="p-2 font-semibold">{name}</td>
                <td className={`p-2 font-mono ${powerAlarm ? 'text-danger font-bold' : ''}`}>{fmt(r?.power_voltage)}</td>
                <td className={`p-2 font-mono ${relayAlarm ? 'text-danger font-bold' : ''}`}>{fmt(r?.relay_voltage)}</td>
                <td className="p-2 font-mono text-muted text-[0.85rem]">{fmtTime(r?.updated_at)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="eyebrow mt-4 mb-2">Ogohlantirishlar tarixi</p>
      <table className="w-full border-collapse text-sky2 text-[0.88rem]">
        <thead>
          <tr className="border-b border-line">
            <th className="text-left p-2 text-muted2 text-[0.7rem] uppercase tracking-[0.1em]">Seksiya</th>
            <th className="text-left p-2 text-muted2 text-[0.7rem] uppercase tracking-[0.1em]">Tomon</th>
            <th className="text-left p-2 text-muted2 text-[0.7rem] uppercase tracking-[0.1em]">Hodisa</th>
            <th className="text-left p-2 text-muted2 text-[0.7rem] uppercase tracking-[0.1em]">Kuchlanish</th>
            <th className="text-left p-2 text-muted2 text-[0.7rem] uppercase tracking-[0.1em]">Vaqt</th>
          </tr>
        </thead>
        <tbody>
          {alarms.length === 0 && (
            <tr><td className="p-2 text-muted" colSpan={5}>Hozircha ogohlantirish yo'q</td></tr>
          )}
          {alarms.map(a => {
            const isEnd = a.event === 'high_end' || a.event === 'low_end'
            return (
              <tr key={a.id} className="border-b border-line">
                <td className="p-2 font-semibold">{normalizeSignalName(a.name)}</td>
                <td className="p-2">{SIDE_LABELS[a.side] || a.side}</td>
                <td className={`p-2 ${isEnd ? 'text-muted' : 'text-danger font-semibold'}`}>{EVENT_LABELS[a.event] || a.event}</td>
                <td className="p-2 font-mono">{fmt(a.voltage)}</td>
                <td className="p-2 font-mono text-muted text-[0.85rem]">{fmtTime(a.ts)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
