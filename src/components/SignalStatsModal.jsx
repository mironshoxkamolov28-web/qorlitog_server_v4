import { normalizeSignalName } from '../utils/signalNames'

const DAY_MS = 24 * 60 * 60 * 1000

function getTs(entry) {
  if (Number.isFinite(+entry.ts) && +entry.ts > 0) return +entry.ts
  const d = new Date(entry.time)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

export default function SignalStatsModal({ archiveList }) {
  const since = Date.now() - DAY_MS
  const counts = {}

  ;(archiveList || []).forEach(entry => {
    if (getTs(entry) < since) return
    const name = normalizeSignalName(entry.name)
    if (!counts[name]) counts[name] = { green: 0, red: 0 }
    if (entry.state === 'green') counts[name].green++
    else if (entry.state === 'red') counts[name].red++
  })

  const rows = Object.entries(counts).sort(
    (a, b) => (b[1].green + b[1].red) - (a[1].green + a[1].red)
  )

  if (!rows.length) {
    return <p className="text-muted2 text-center py-6">So'nggi 24 soatda o'zgarish qayd etilmagan</p>
  }

  return (
    <div className="overflow-x-auto">
      <p className="text-muted2 text-[0.85rem] mb-3">So'nggi 24 soat ichidagi o'zgarishlar soni</p>
      <table className="w-full border-collapse text-sky2 text-[0.92rem]">
        <thead>
          <tr className="border-b border-line">
            <th className="text-left p-2 text-muted2 text-[0.74rem] uppercase tracking-[0.1em]">Signal</th>
            <th className="text-left p-2 text-muted2 text-[0.74rem] uppercase tracking-[0.1em]">Ochilgan</th>
            <th className="text-left p-2 text-muted2 text-[0.74rem] uppercase tracking-[0.1em]">Yopilgan</th>
            <th className="text-left p-2 text-muted2 text-[0.74rem] uppercase tracking-[0.1em]">Jami</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, c]) => (
            <tr key={name} className="border-b border-line">
              <td className="p-2 font-semibold">{name}</td>
              <td className="p-2 text-ok font-mono">{c.green}</td>
              <td className="p-2 text-danger font-mono">{c.red}</td>
              <td className="p-2 font-mono text-muted">{c.green + c.red}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
