import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_WIDTH = 360
const MIN_HEIGHT = 240
const MARGIN = 8

export default function Modal({ title, onClose, children }) {
  const panelRef = useRef(null)
  const [pos, setPos] = useState(null) // null = hali markazlashtirilmagan (birinchi render)
  const [size, setSize] = useState(() => ({
    width: Math.min(860, window.innerWidth * 0.92),
    height: Math.min(640, window.innerHeight * 0.85),
  }))

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Birinchi render'da oyna ekran markazida — shu joyni "boshlang'ich" pozitsiya
  // sifatida saqlab olamiz, shundan keyin sudrab ko'chirish mumkin bo'ladi.
  useEffect(() => {
    if (pos) return
    const el = panelRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({ x: rect.left, y: rect.top })
  }, [pos])

  // Oyna doim ekran ichida qolishi uchun (sudrab yoki o'lchamini o'zgartirib
  // "X" tugmasini ekrandan chiqarib yuborib bo'lmasin) — ikkalasi ham ekran
  // chegarasidan oshmaydigan qilib cheklanadi.
  const handleDragStart = useCallback((e) => {
    if (!pos || e.button !== 0) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startPos = pos
    const maxX = Math.max(0, window.innerWidth - size.width)
    const maxY = Math.max(0, window.innerHeight - size.height)
    function onMove(ev) {
      const nextX = Math.min(maxX, Math.max(0, startPos.x + (ev.clientX - startX)))
      const nextY = Math.min(maxY, Math.max(0, startPos.y + (ev.clientY - startY)))
      setPos({ x: nextX, y: nextY })
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos, size])

  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startSize = size
    const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - (pos?.x ?? 0) - MARGIN)
    const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - (pos?.y ?? 0) - MARGIN)
    function onMove(ev) {
      setSize({
        width: Math.min(maxWidth, Math.max(MIN_WIDTH, startSize.width + (ev.clientX - startX))),
        height: Math.min(maxHeight, Math.max(MIN_HEIGHT, startSize.height + (ev.clientY - startY))),
      })
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos, size])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="modal-panel surface-panel p-4 flex flex-col"
        style={
          pos
            ? { position: 'fixed', left: pos.x, top: pos.y, width: size.width, height: size.height, margin: 0 }
            : { width: size.width, height: size.height }
        }
        onMouseDown={e => e.stopPropagation()}
      >
        <div
          className="flex justify-between items-center mb-3 shrink-0 cursor-move select-none"
          onMouseDown={handleDragStart}
          title="Ko'chirish uchun ushlab suring"
        >
          <h2 className="text-[1.05rem] font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="btn !px-2.5 !py-1">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
        <div
          className="modal-resize-handle"
          onMouseDown={handleResizeStart}
          title="O'lchamini o'zgartirish uchun suring"
        />
      </div>
    </div>
  )
}
