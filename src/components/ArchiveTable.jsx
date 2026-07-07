function Th({ children }) {
  return <th className="text-left p-2 text-muted2 text-[0.74rem] uppercase tracking-[0.1em]">{children}</th>
}

function StateBadge({ state }) {
  const open = state === 'green'
  return (
    <span className={`inline-flex items-center gap-1.5 ${open ? 'text-ok' : 'text-danger'}`}>
      <span className={`w-2 h-2 rounded-full ${open ? 'bg-ok' : 'bg-danger'}`} />
      {open ? 'Ochiq' : 'Band'}
    </span>
  )
}

export default function ArchiveTable({ archiveList, onSelectTime, fetchError }) {
  const emptyMsg = fetchError ? `Xatolik: ${fetchError}` : "Arxiv bo'sh"
  const hasRows = archiveList && archiveList.length > 0
  const list = hasRows ? archiveList.slice(0, 100) : []

  return (
    <section className="surface-panel rounded-xl p-4 mt-3">
      <div className="flex justify-between items-end gap-2.5 mb-3.5">
        <div>
          <p className="eyebrow">Signal arxivi</p>
          <h2 className="text-[1.05rem] font-bold mt-1">
            So'nggi o'zgarishlar{hasRows ? ` (${archiveList.length})` : ''}
          </h2>
        </div>
      </div>
      <table className="w-full border-collapse text-sky2 text-[0.92rem]">
        <thead>
          <tr className="border-b border-line">
            <Th>Signal</Th>
            <Th>Holat</Th>
            <Th>Vaqt</Th>
            <Th>Qurilma</Th>
          </tr>
        </thead>
        <tbody>
          {!hasRows ? (
            <tr>
              <td colSpan={4} className={`text-center p-4 ${fetchError ? 'text-danger' : 'text-muted2'}`}>
                {emptyMsg}
              </td>
            </tr>
          ) : (
            list.map((entry, i) => (
              <tr
                key={`${entry.ts || entry.time}-${entry.name}-${i}`}
                onClick={() => onSelectTime(entry)}
                className="cursor-pointer border-b border-line hover:bg-[#181d24]"
              >
                <td className="p-2 font-semibold">{entry.name}</td>
                <td className="p-2"><StateBadge state={entry.state} /></td>
                <td className="p-2 font-mono text-muted text-[0.85rem]">{entry.time}</td>
                <td className="p-2 text-muted2 text-[0.85rem]">{entry.device || '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  )
}
