import { useCallback, useEffect } from 'react'
import { useSignalState } from './hooks/useSignalState'
import { useWebSocket } from './hooks/useWebSocket'
import { useSupabaseSync } from './hooks/useSupabaseSync'
import { normalizeSignalName } from './utils/signalNames'

// VITE_SUPABASE_URL berilgan bo'lsa — bulutli (Supabase) manba, aks holda
// lokal server.js (WebSocket) ishlatiladi. Ikkalasi ham bir xil interfeys
// qaytaradi: { connStatus, loadStatus, fetchError, devices }.
const useLiveData = import.meta.env.VITE_SUPABASE_URL ? useSupabaseSync : useWebSocket
import HeroBar from './components/HeroBar'
import Monosxema from './components/Monosxema'
import StatsPanel from './components/StatsPanel'
import ArchivePanel from './components/ArchivePanel'
import ArchiveTable from './components/ArchiveTable'

// Arxiv yozuvining vaqtini olish.
// 1) Yangi yozuvlarda server 'ts' (epoch ms) beradi — eng ishonchli yo'l.
// 2) Eski yozuvlar uchun 'time' matni parse qilinadi. Node toLocaleString('uz-UZ')
//    "02/07/2026, 14:05:09" (VERGUL bilan) formatida beradi, shuning uchun
//    regex vergulga ham chidamli qilingan.
function parseArchiveTime(entry) {
  if (!entry) return null
  if (Number.isFinite(+entry.ts) && +entry.ts > 0) return new Date(+entry.ts)
  const str = entry.time
  if (!str) return null
  const m = String(str).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2}):(\d{2})/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6])
  // Oxirgi urinish: ISO yoki brauzer tushunadigan boshqa format
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

function computeSnapshotAt(targetDate, archiveList) {
  const list = archiveList || []
  if (!list.length) return null
  const snapshot = {}
  ;[...list].reverse().forEach(entry => {
    const t = parseArchiveTime(entry)
    if (!t) return
    if (t > targetDate) return
    snapshot[normalizeSignalName(entry.name)] = entry.state
  })
  return Object.keys(snapshot).length ? snapshot : null
}

export default function App() {
  const {
    signalStates,
    archiveList,
    setArchiveList,
    isArchiveMode,
    setArchiveMode,
    resetToRealtime,
    applySignalData,
    applySnapshot
  } = useSignalState()

  const { connStatus, loadStatus, fetchError, devices } = useLiveData({
    applySignalData,
    setArchiveList,
    isArchiveMode
  })

  const handleShowArchive = useCallback((targetDate) => {
    const snapshot = computeSnapshotAt(targetDate, archiveList)
    if (!snapshot || Object.keys(snapshot).length === 0) {
      alert("Bu vaqtda arxiv ma'lumoti yo'q!")
      return
    }
    applySnapshot(snapshot)
    setArchiveMode(true)
  }, [archiveList, applySnapshot, setArchiveMode])

  const handleRealtime = useCallback(() => {
    resetToRealtime()
    // force=true: arxiv rejimi bayrog'i hali yangilanmagan bo'lsa ham
    // joriy holat darhol yuklanadi
    loadStatus(true)
  }, [resetToRealtime, loadStatus])

  const handleArchiveRowClick = useCallback((entry) => {
    const t = parseArchiveTime(entry)
    if (!t) return
    handleShowArchive(t)
  }, [handleShowArchive])

  useEffect(() => {
    if (!isArchiveMode) {
      loadStatus()
    }
  }, [isArchiveMode, loadStatus])

  return (
    <main className="w-full min-h-screen">
      <HeroBar connStatus={connStatus} devices={devices} />
      <Monosxema signalStates={signalStates} isArchiveMode={isArchiveMode} />
      <StatsPanel signalStates={signalStates} />
      <ArchivePanel
        archiveList={archiveList}
        onShowArchive={handleShowArchive}
        onRealtime={handleRealtime}
        connStatus={connStatus}
        archiveCount={archiveList.length}
        fetchError={fetchError}
      />
      <ArchiveTable
        archiveList={archiveList}
        onSelectTime={handleArchiveRowClick}
        fetchError={fetchError}
      />
    </main>
  )
}
