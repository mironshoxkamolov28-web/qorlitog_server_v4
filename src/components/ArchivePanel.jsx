import { useState, useCallback } from 'react'

export default function ArchivePanel({ onShowArchive, onRealtime, archiveCount, fetchError }) {
  const [selectedTime, setSelectedTime] = useState('')

  const handleShow = useCallback(() => {
    if (!selectedTime) return
    onShowArchive(new Date(selectedTime))
  }, [selectedTime, onShowArchive])

  return (
    <div>
      <div className="flex justify-between items-end gap-2.5 mb-3.5 flex-wrap">
        <div>
          <p className="eyebrow">Arxiv bo'limi</p>
          <h2 className="text-[1.05rem] font-bold mt-1">Vaqt bo'yicha holat ko'rish</h2>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <span className={`text-[0.78rem] font-mono ${fetchError ? 'text-danger' : 'text-muted'}`}>
            {fetchError ? fetchError : `${archiveCount} ta yozuv`}
          </span>
          <button type="button" onClick={onRealtime} className="btn">
            <span className="w-1.5 h-1.5 rounded-full bg-ok" />
            Live rejim
          </button>
        </div>
      </div>
      <div className="flex gap-4 items-end flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-sky2 text-[0.84rem] mb-1.5">Vaqtni tanlang</label>
          <input
            type="datetime-local"
            value={selectedTime}
            onChange={e => setSelectedTime(e.target.value)}
            className="input-flat"
          />
        </div>
        <div>
          <button type="button" onClick={handleShow} className="btn">
            Ko'rsat
          </button>
        </div>
      </div>
    </div>
  )
}
