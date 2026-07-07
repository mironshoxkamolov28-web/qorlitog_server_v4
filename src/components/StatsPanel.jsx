import { normalizeSignalName } from '../utils/signalNames'

// Yashil/qizil hisobiga faqat 8 ta asosiy (kirish-chiqish) svetofor kiradi.
// ПС/ПП, КП, ДСО/ПП — ikki holatli indikatorlar, "ochiq/band" ularga tegishli emas.
const SIGNAL_KEYS = ['N1', 'N2', 'N4', 'N', 'Ч1', 'Ч2', 'Ч4', 'Ч']

function StatCard({ label, value, hint, valueClass = 'text-white' }) {
  return (
    <article className="surface-card rounded-xl p-3.5">
      <span className="block uppercase tracking-[0.14em] text-[0.7rem] text-muted2">{label}</span>
      <strong className={`block text-[1.7rem] my-1 font-mono ${valueClass}`}>{value}</strong>
      <small className="text-muted text-[0.85rem]">{hint}</small>
    </article>
  )
}

export default function StatsPanel({ signalStates }) {
  const vals = SIGNAL_KEYS.map(k => signalStates[normalizeSignalName(k)] || 'red')
  const greenCount = vals.filter(v => v === 'green').length
  const redCount = vals.filter(v => v === 'red').length

  return (
    <section className="surface-panel rounded-xl p-4 mt-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2.5 mb-3.5">
        <div>
          <p className="eyebrow">Statistika</p>
          <h2 className="text-[1.05rem] font-bold mt-1">Umumiy holat va ko'rsatkichlar</h2>
        </div>
        <span className="text-muted2 text-[0.88rem]">Yo'llar va svetoforlar bo'yicha</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Umumiy yo'llar" value="8" hint="Asosiy yo'llar, shoxlar va yon yo'laklar" />
        <StatCard
          label="Umumiy svetoforlar"
          value="14"
          hint="8 asosiy + ПС/ПП, КП, ДСО/ПП indikatorlari (2 tomon)"
        />
        <StatCard
          label="Ochiq"
          value={greenCount}
          hint="8 asosiy svetofor bo'yicha"
          valueClass="text-ok"
        />
        <StatCard
          label="Band"
          value={redCount}
          hint="8 asosiy svetofor bo'yicha"
          valueClass="text-danger"
        />
      </div>
    </section>
  )
}
