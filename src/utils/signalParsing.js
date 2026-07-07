/**
 * Holat qiymatini kanonik 'green'/'red' ga keltirish.
 * Qabul qilinadi: green/red, GREEN/RED, 1/0, true/false, on/off,
 * high/low, yashil/qizil, ochiq/band, +/-
 */
export const GREEN_VALUES = new Set(['green', 'g', 'yashil', 'ochiq', 'on', 'high', 'true', '1', 'plus', '+'])
export const RED_VALUES = new Set(['red', 'r', 'qizil', 'band', 'off', 'low', 'false', '0', 'minus', '-'])

export function parseStateValue(v) {
  if (v === undefined || v === null) return null
  const s = String(v).trim().toLowerCase()
  if (GREEN_VALUES.has(s)) return 'green'
  if (RED_VALUES.has(s)) return 'red'
  return null
}

// Muqobil kalit nomlari (ESP32 firmware'ida turlicha atalgan bo'lishi mumkin)
export const NAME_KEYS = ['name', 'signal', 'signal_name', 'id', 'n']
export const STATE_KEYS = ['state', 'value', 'status', 'holat', 'val', 's']

export function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]) !== '') return obj[k]
  }
  return undefined
}
