import { useEffect } from 'react'

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel surface-panel p-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-[1.05rem] font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="btn !px-2.5 !py-1">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
