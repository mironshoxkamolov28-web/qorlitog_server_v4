/**
 * QORLI TOG' STANSIYASI — LOCAL SERVER (ESM)
 * Node.js HTTP server + WebSocket real-time yangilanish
 *
 * Ishlatish:
 *   npm install          (ws ham endi dependency)
 *   npm run build        (React -> dist/)
 *   node server.js
 */

import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { networkInterfaces } from 'os'
import { normalizeSignalName, normalizeSignalMap } from './src/utils/signalNames.js'
import { parseStateValue, NAME_KEYS, STATE_KEYS, pick } from './src/utils/signalParsing.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// --- WebSocket modulini ixtiyoriy yuklash ---
let WebSocketServer = null
try {
  ({ WebSocketServer } = await import('ws'))
} catch (_) {
  console.warn("ws moduli topilmadi. WebSocket o'rniga 5s polling ishlaydi. \"npm install ws\" bajaring.")
}

const PORT = 3000
const ARCHIVE_FILE = path.join(__dirname, 'archive.json')
// Arxivda saqlanadigan yozuvlar soni. Eslatma: bu limitdan eski hodisalar
// o'chiriladi, demak juda eski vaqt uchun snapshot chiqmasligi mumkin.
const ARCHIVE_LIMIT = 2000
const DIST_DIR = path.join(__dirname, 'dist')

// Boshlang'ich signal ro'yxati (kalitlar quyida normalizatsiya qilinadi)
const RAW_INITIAL_SIGNALS = {
    'N1': 'red', 'N': 'red', 'N2': 'red', 'N4': 'red',
    'Ч':  'red', 'Ч1': 'red', 'Ч2': 'red', 'Ч4': 'red',
    '1НП': 'red', '2СП': 'red', '3-5СП': 'red', '1СП': 'red',
    '4-6СП': 'red', '1ЧП': 'red', 'IП': 'red', 'IIП': 'red', 'IVП': 'red',
    'ПС/ПП_N': 'red', 'КП_N': 'red', 'ДСО/ПП_N': 'red',
    'ПС/ПП_Ч': 'red', 'КП_Ч': 'red', 'ДСО/ПП_Ч': 'red',
    '1ПК': 'red', '1МК': 'red',
    '5ПК': 'red', '5МК': 'red',
    '2-4ПК': 'red', '2-4МК': 'red',
    '6ПК': 'red', '6МК': 'red'
}

let state = {
  signals: normalizeSignalMap(RAW_INITIAL_SIGNALS),
  archive: []
}

// Arxiv yozuvi uchun yagona vaqt: ts (epoch ms, hisob-kitob uchun)
// va time (ko'rsatish uchun matn). ts bo'lmasa hozirgi vaqt olinadi.
function makeTimestamp(tsInput) {
  const ts = Number.isFinite(+tsInput) && +tsInput > 0 ? +tsInput : Date.now()
  return { ts, time: new Date(ts).toLocaleString('uz-UZ') }
}

// --- Arxiv yuklash / saqlash ---
function loadArchive() {
  try {
    const raw = fs.readFileSync(ARCHIVE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.archive)) state.archive = parsed.archive
    if (parsed && parsed.signals) state.signals = { ...state.signals, ...normalizeSignalMap(parsed.signals) }
  } catch (_) { state.archive = [] }
}

function saveArchive() {
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(state, null, 2), 'utf8')
}

loadArchive()

// --- WebSocket mijozlar ---
const wsClients = new Set()
function broadcast(data) {
  const msg = JSON.stringify(data)
  wsClients.forEach(ws => { if (ws.readyState === 1) ws.send(msg) })
}

// ESP32 qurilmalarining oxirgi ko'rinish vaqti (diskka yozilmaydi — server
// qayta ishga tushganda hammasi "oflayn"dan boshlaydi, bu to'g'ri xulq).
const deviceLastSeen = {}
function touchDevice(id) {
  if (id) deviceLastSeen[String(id)] = Date.now()
}
function withDevices(s) {
  return { ...s, devices: deviceLastSeen }
}

// --- Body o'qish (xom matn holida) ---
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) { req.destroy(); reject(new Error('Too large')) } })
    req.on('end', () => resolve(body))
  })
}

// ESP32 turli ko'rinishda yuborishi mumkin — hammasini tanishga harakat qilamiz:
// JSON, form (name=X&state=Y), yoki GET query (?name=X&state=Y)
function parsePayload(raw, query) {
  if (raw && raw.trim()) {
    try { return { data: JSON.parse(raw), src: 'json' } } catch (_) {}
    if (raw.includes('=')) {
      const obj = Object.fromEntries(new URLSearchParams(raw).entries())
      if (Object.keys(obj).length) return { data: obj, src: 'form' }
    }
    return { data: null, src: 'notanish' }
  }
  if (query) {
    const obj = Object.fromEntries(new URLSearchParams(query).entries())
    if (Object.keys(obj).length) return { data: obj, src: 'query' }
  }
  return { data: null, src: "bo'sh" }
}

function logUpdate(raw, src) {
  const stamp = new Date().toLocaleTimeString('uz-UZ')
  const shown = raw && raw.trim() ? raw.slice(0, 300) : '(tana bo\'sh)'
  console.log(`[${stamp}] /api/update (${src}) <- ${shown}`)
}

// --- Static fayllar ---
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon'
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath)
  const mime = MIME[ext] || 'text/plain'
  try {
    const data = fs.readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': mime })
    res.end(data)
  } catch (_) {
    res.writeHead(404); res.end('Not found')
  }
}

// dist/ tayyor emasligini ogohlantirish
function distMissingResponse(res) {
  res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end('<h1>dist/ topilmadi</h1><p>Avval React loyihasini yig\'ing: <code>npm run build</code></p>')
}

// --- HTTP Server ---
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = req.url.split('?')[0]

  // API: holat olish
  if (url === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(withDevices(state)))
    return
  }

  // API: signal yangilash (ESP32 dan keladi). POST (JSON/form) va GET (?name=&state=)
  if (url === '/api/update' && (req.method === 'POST' || req.method === 'GET')) {
    try {
      const raw = req.method === 'POST' ? await readRawBody(req) : ''
      const query = req.url.includes('?') ? req.url.split('?')[1] : ''
      const { data, src } = parsePayload(raw, query)
      logUpdate(raw || query, src)

      if (!data) {
        console.warn("   ⚠ So'rov tanasi tanilmadi. Kutilgan format namunasi:")
        console.warn('     {"name":"2СП","state":"green","device":"esp32-1"}')
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          ok: false,
          error: "Format tanilmadi. JSON yuboring, masalan: {\"name\":\"2СП\",\"state\":\"green\"}"
        }))
        return
      }

      touchDevice(data.device)

      const applied = []   // haqiqiy o'zgarishlar (arxiv/broadcast uchun)
      const rejected = []  // holati tushunarsiz bo'lganlar
      let recognized = 0   // tanilgan, lekin o'zgarmagan signallar (heartbeat)

      // 1) To'liq xarita: { signals: { "Ч1": "green", ... } } — heartbeat.
      // O'zgarmagan qiymatlar qabul qilinadi, lekin disk/efirni band qilmaydi.
      if (data.signals && typeof data.signals === 'object') {
        Object.entries(data.signals).forEach(([k, v]) => {
          const st = parseStateValue(v)
          const nm = normalizeSignalName(k)
          if (!st) { rejected.push(`${nm}: "${v}"`); return }
          recognized++
          if (state.signals[nm] !== st) {
            state.signals[nm] = st
            applied.push(`${nm}\u2192${st}`)
          }
        })
      }

      // 2) Hodisalar ro'yxati: { events: [ { name, state }, ... ] }
      if (data.events && Array.isArray(data.events)) {
        data.events.forEach(ev => {
          if (!ev) return
          const rawName = pick(ev, NAME_KEYS)
          const st = parseStateValue(pick(ev, STATE_KEYS))
          if (!rawName || !st) { rejected.push(JSON.stringify(ev).slice(0, 80)); return }
          const nm = normalizeSignalName(rawName)
          const { ts, time } = makeTimestamp(ev.ts)
          const device = ev.device || data.device
          touchDevice(device)
          state.signals[nm] = st
          state.archive.unshift({ name: nm, state: st, ts, time: ev.time || time, ...(device ? { device } : {}) })
          recognized++
          applied.push(`${nm}\u2192${st}`)
        })
        state.archive = state.archive.slice(0, ARCHIVE_LIMIT)
      }

      // 3) Bitta signal: { name, state } (yoki signal/value, status kabi muqobil kalitlar)
      const rawName = pick(data, NAME_KEYS)
      const rawState = pick(data, STATE_KEYS)
      if (rawName !== undefined) {
        const st = parseStateValue(rawState)
        if (st) {
          const nm = normalizeSignalName(rawName)
          const { ts, time } = makeTimestamp(data.ts)
          state.signals[nm] = st
          state.archive.unshift({
            name: nm, state: st, ts,
            time: data.time || time,
            ...(data.device ? { device: data.device } : {})
          })
          state.archive = state.archive.slice(0, ARCHIVE_LIMIT)
          recognized++
          applied.push(`${normalizeSignalName(rawName)}\u2192${st}`)
        } else {
          rejected.push(`${rawName}: "${rawState}"`)
        }
      }

      if (applied.length) console.log('   \u2713 qabul qilindi:', applied.join(', '))
      else if (recognized) console.log(`   = heartbeat: ${recognized} signal, o'zgarish yo'q`)
      if (rejected.length) {
        console.warn('   \u26a0 holati tushunarsiz (green/red, 1/0, on/off kutiladi):', rejected.join('; '))
      }
      if (!recognized && !rejected.length) {
        console.warn("   \u26a0 name/state kaliti topilmadi. Kelgan kalitlar:", Object.keys(data).join(', ') || '(yo\'q)')
      }

      // Disk va WebSocket faqat haqiqiy o'zgarishda ishlaydi
      if (applied.length) {
        saveArchive()
        broadcast({ type: 'update', state: withDevices(state) })
      }

      const ok = recognized > 0
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(
        ok
          ? { ok: true, applied, unchanged: recognized - applied.length }
          : { ok: false, error: "Hech narsa qabul qilinmadi", rejected, kelganKalitlar: Object.keys(data) }
      ))
    } catch (err) {
      console.warn('   \u26a0 /api/update xatosi:', err.message)
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: err.message }))
    }
    return
  }

  // API: arxivni tozalash
  if (url === '/api/clear-archive' && req.method === 'POST') {
    state.archive = []
    saveArchive()
    broadcast({ type: 'update', state: withDevices(state) })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  // --- Static (yig'ilgan React: dist/) + SPA fallback ---
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    distMissingResponse(res)
    return
  }

  const safeUrl = path.normalize(url).replace(/^(\.\.[/\\])+/, '')
  let filePath = path.join(DIST_DIR, safeUrl === '/' ? 'index.html' : safeUrl)

  // dist/ tashqarisiga chiqishni taqiqlash (path traversal himoyasi)
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveStatic(res, filePath)
  } else {
    // Topilmagan yo'llar React-ga (SPA) qaytariladi
    serveStatic(res, path.join(DIST_DIR, 'index.html'))
  }
})

// --- WebSocket ---
if (WebSocketServer) {
  const wss = new WebSocketServer({ server })
  wss.on('connection', ws => {
    wsClients.add(ws)
    ws.send(JSON.stringify({ type: 'init', state: withDevices(state) }))
    ws.on('close', () => wsClients.delete(ws))
    ws.on('error', () => wsClients.delete(ws))
  })
  console.log('WebSocket ham ishga tushdi')
}

server.listen(PORT, '0.0.0.0', () => {
  const nets = networkInterfaces()
  let localIP = 'localhost'
  for (const iface of Object.values(nets)) {
    for (const i of iface) {
      if (i.family === 'IPv4' && !i.internal) { localIP = i.address; break }
    }
  }
  console.log(`\n✅ Server ishga tushdi!`)
  console.log(`   Brauzerda oching : http://localhost:${PORT}`)
  console.log(`   Tarmoqda         : http://${localIP}:${PORT}`)
  console.log(`   ESP32 URL        : http://${localIP}:${PORT}/api/update\n`)
})
