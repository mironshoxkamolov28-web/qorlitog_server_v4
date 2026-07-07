/**
 * Signal nomlarini bir xil (kanonik) ko'rinishga keltirish.
 *
 * Muammo: signal nomlarida kirill va lotin harflari aralash ishlatiladi
 * ('Ч', 'С', 'П', 'А', 'К', 'М' — kirill; 'N', 'I' — lotin), ESP32
 * firmware'ida esa ko'rinishi bir xil bo'lgan lotin harflari yozilib
 * qolishi mumkin (masalan lotin 'C' o'rniga kirill 'С').
 *
 * Kanonik qoida:
 *   - 'Н' (kirill) va 'H' (lotin) -> 'N' (lotin)
 *   - lotin 'C' -> kirill 'С'
 *   - lotin 'A' -> kirill 'А'
 *   - lotin 'K' -> kirill 'К'
 *   - lotin 'M' -> kirill 'М'
 * Raqamlar va boshqa belgilar o'zgarmaydi.
 */
const CHAR_MAP = {
  'Н': 'N', // kirill En -> lotin N
  'H': 'N', // lotin H (ko'rinishi Н ga o'xshash) -> lotin N
  'C': 'С', // lotin C -> kirill Es
  'A': 'А', // lotin A -> kirill A
  'K': 'К', // lotin K -> kirill Ka
  'M': 'М', // lotin M -> kirill Em
  'P': 'П', // lotin P (transliteratsiya) -> kirill Pe; kanonik nomlarda lotin P ishlatilmaydi
};

export function normalizeSignalName(name) {
  if (name === null || name === undefined) return '';
  return String(name)
    .trim()
    .replace(/[НHCAKMP]/g, ch => CHAR_MAP[ch] || ch);
}

export function normalizeSignalMap(signals) {
  if (!signals || typeof signals !== 'object' || Array.isArray(signals)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(signals).map(([key, value]) => [normalizeSignalName(key), value])
  );
}
