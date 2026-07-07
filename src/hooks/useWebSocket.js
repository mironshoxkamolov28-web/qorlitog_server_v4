import { useEffect, useRef, useState, useCallback } from 'react'

const API_URL = `http://${location.hostname}:3000/api`
const WS_URL = `ws://${location.hostname}:3000`

export function useWebSocket({ applySignalData, setArchiveList, isArchiveMode }) {
  const [connStatus, setConnStatus] = useState('connecting')
  const [fetchError, setFetchError] = useState(null)
  const [devices, setDevices] = useState({})
  const wsRef = useRef(null)
  const retryRef = useRef(0)
  const timerRef = useRef(null)

  // MUHIM: WebSocket onmessage va setInterval faqat bir marta (mount paytida)
  // yaratiladi. Agar isArchiveMode to'g'ridan-to'g'ri closure orqali o'qilsa,
  // u doim mount paytidagi (false) qiymatda "muzlab" qoladi va arxiv rejimida
  // jonli ma'lumot snapshot ustidan yozib yuboradi. Shuning uchun ref ishlatiladi.
  const archiveModeRef = useRef(isArchiveMode)
  useEffect(() => {
    archiveModeRef.current = isArchiveMode
  }, [isArchiveMode])

  // force=true — arxiv rejimidan Live ga qaytishda darhol yangilash uchun
  const loadStatus = useCallback(async (force = false) => {
    try {
      const res = await fetch(`${API_URL}/status`)
      if (!res.ok) {
        setFetchError(`Server javob berdi: ${res.status}`)
        return
      }
      const data = await res.json()
      // Arxiv ro'yxati har doim yangilanadi (jadval yangi hodisalarni ko'rsatsin)
      setArchiveList(data.archive || [])
      if (data.devices) setDevices(data.devices)
      setFetchError(null)
      // Monosxema esa faqat Live rejimda yangilanadi
      if ((force || !archiveModeRef.current) && data.signals) {
        applySignalData(data.signals)
      }
    } catch (e) {
      setFetchError(`Server bilan aloqa yo'q: ${e.message}`)
      console.warn('Server bilan aloqa yo\'q:', e.message)
    }
  }, [applySignalData, setArchiveList])

  const applyState = useCallback((data) => {
    if (data.archive) {
      setArchiveList(data.archive)
    }
    if (data.devices) setDevices(data.devices)
    if (archiveModeRef.current) return
    if (data.signals) {
      applySignalData(data.signals)
    }
  }, [applySignalData, setArchiveList])

  useEffect(() => {
    let disposed = false

    function connectWS() {
      if (disposed) return
      try {
        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        ws.onopen = () => {
          retryRef.current = 0
          setConnStatus('online')
        }

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.state) applyState(msg.state)
          } catch (_) {}
        }

        ws.onclose = () => {
          if (disposed) return
          setConnStatus('reconnecting')
          retryRef.current++
          const delay = Math.min(retryRef.current * 1500, 10000)
          timerRef.current = setTimeout(connectWS, delay)
        }

        ws.onerror = () => ws.close()
      } catch (e) {
        timerRef.current = setTimeout(connectWS, 3000)
      }
    }

    connectWS()
    loadStatus()

    // WebSocket uzilib qolsa ham 5s da bir marta yangilanadi (fallback polling)
    const pollTimer = setInterval(() => loadStatus(), 5000)

    return () => {
      disposed = true
      if (wsRef.current) wsRef.current.close()
      if (timerRef.current) clearTimeout(timerRef.current)
      clearInterval(pollTimer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { connStatus, loadStatus, fetchError, devices }
}
