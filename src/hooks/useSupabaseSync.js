import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const ARCHIVE_QUERY_LIMIT = 2000

export function useSupabaseSync({ applySignalData, setArchiveList, isArchiveMode }) {
  const [connStatus, setConnStatus] = useState('connecting')
  const [fetchError, setFetchError] = useState(null)
  const [devices, setDevices] = useState({})

  // MUHIM: Realtime callback'lar faqat mount paytida yaratiladi (useWebSocket'dagi
  // bilan bir xil sabab) — archiveModeRef orqali o'qiladi, aks holda arxiv rejimida
  // jonli ma'lumot snapshot ustidan yozib yuboradi.
  const archiveModeRef = useRef(isArchiveMode)
  useEffect(() => { archiveModeRef.current = isArchiveMode }, [isArchiveMode])

  const touchDevice = useCallback((device, updatedAt) => {
    if (!device) return
    const t = new Date(updatedAt).getTime()
    setDevices(prev => (prev[device] >= t ? prev : { ...prev, [device]: t }))
  }, [])

  const loadStatus = useCallback(async (force = false) => {
    const { data: signalRows, error: sErr } = await supabase.from('signals').select('*')
    if (sErr) { setFetchError(sErr.message); return }

    ;(signalRows || []).forEach(r => touchDevice(r.device, r.updated_at))
    if (force || !archiveModeRef.current) {
      applySignalData(Object.fromEntries((signalRows || []).map(r => [r.name, r.state])))
    }

    const { data: archiveRows, error: aErr } = await supabase
      .from('archive')
      .select('*')
      .order('ts', { ascending: false })
      .limit(ARCHIVE_QUERY_LIMIT)
    if (aErr) { setFetchError(aErr.message); return }
    setArchiveList(archiveRows || [])
    setFetchError(null)
  }, [applySignalData, setArchiveList, touchDevice])

  useEffect(() => {
    loadStatus()

    const channel = supabase
      .channel('qorlitog-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signals' }, (payload) => {
        const row = payload.new
        if (!row) return
        touchDevice(row.device, row.updated_at)
        if (!archiveModeRef.current) {
          applySignalData({ [row.name]: row.state })
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'archive' }, (payload) => {
        setArchiveList(prev => [payload.new, ...prev])
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnStatus('online')
        else if (['CLOSED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) setConnStatus('reconnecting')
      })

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { connStatus, loadStatus, fetchError, devices }
}
