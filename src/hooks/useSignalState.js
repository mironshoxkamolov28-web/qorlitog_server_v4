import { useState, useCallback } from 'react'
import { normalizeSignalName, normalizeSignalMap } from '../utils/signalNames'

// Diqqat: kalitlar quyida normalizeSignalMap orqali kanonik ko'rinishga
// keltiriladi ('1НП' -> '1NП' va h.k.), aks holda kirill Н li kalitlar
// hech qachon yangilanmaydigan "o'lik" kalit bo'lib qolardi.
const RAW_INITIAL_STATES = {
  'N1': 'red', 'N': 'red', 'N2': 'red', 'N4': 'red',
  'Ч': 'red', 'Ч1': 'red', 'Ч2': 'red', 'Ч4': 'red',
  '1НП': 'red', '2СП': 'red', '3-5СП': 'red', '1СП': 'red',
  '4-6СП': 'red', '1ЧП': 'red', 'IП': 'red', 'IIП': 'red', 'IVП': 'red',
  'ПС/ПП_Ч': 'red', 'КП_Ч': 'red', 'ДСО/ПП_Ч': 'red',
  'ПС/ПП_N': 'red', 'КП_N': 'red', 'ДСО/ПП_N': 'red',
  '1ПК': 'red', '1МК': 'red', '2ПК': 'red', '2МК': 'red',
  '3-5ПК': 'red', '3-5МК': 'red', '4-6ПК': 'red', '4-6МК': 'red'
}

const INITIAL_STATES = normalizeSignalMap(RAW_INITIAL_STATES)

export function useSignalState() {
  const [signalStates, setSignalStates] = useState(INITIAL_STATES)
  const [archiveList, setArchiveList] = useState([])
  const [isArchiveMode, setIsArchiveMode] = useState(false)

  const applySignalData = useCallback((signals) => {
    if (!signals) return
    setSignalStates(prev => {
      const next = { ...prev }
      Object.entries(signals).forEach(([k, v]) => {
        next[normalizeSignalName(k)] = v
      })
      return next
    })
  }, [])

  // Arxiv snapshot: snapshot'da bo'lmagan signallar 'red' (band) deb olinadi,
  // chunki arxivda faqat O'ZGARGAN hodisalar saqlanadi.
  const applySnapshot = useCallback((snapshot) => {
    setSignalStates(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => next[k] = 'red')
      Object.entries(snapshot).forEach(([k, v]) => {
        next[normalizeSignalName(k)] = v
      })
      return next
    })
  }, [])

  const resetToRealtime = useCallback(() => {
    setIsArchiveMode(false)
  }, [])

  const setArchiveMode = useCallback((mode) => {
    setIsArchiveMode(mode)
  }, [])

  return {
    signalStates,
    archiveList,
    setArchiveList,
    isArchiveMode,
    setArchiveMode,
    resetToRealtime,
    applySignalData,
    applySnapshot
  }
}
