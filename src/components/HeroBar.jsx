import { useState, useEffect } from 'react'

// Ulanish holati kodlari (useWebSocket dan keladi) -> yozuv + indikator rangi
const STATUS = {
  connecting:   { label: "Ulanmoqda…",         dot: 'bg-warn' },
  online:       { label: 'Onlayn · WebSocket', dot: 'bg-ok' },
  reconnecting: { label: "Qayta ulanmoqda…",   dot: 'bg-warn' },
}

// ESP32 shuncha vaqt (ms) sado bermasa "oflayn" deb ko'rsatiladi. ESP32
// odatda har necha soniyada bir heartbeat yuboradi deb kutiladi — bu qiymat
// firmware'dagi yuborish oralig'idan (hozir 10s) 2-3 baravar katta bo'lishi kerak.
const DEVICE_OFFLINE_MS = 25000

// Faqat shu naqshga mos qurilmalar ko'rsatiladi — test/qo'lda yozilgan
// tasodifiy device nomlari (masalan debug skriptlaridan) chiqmasligi uchun.
const KNOWN_DEVICE_RE = /^esp32-\d+$/

export default function HeroBar({ connStatus, devices, theme, onToggleTheme, onOpenArchive, onOpenStats, onOpenRailVoltage }) {
  const [clock, setClock] = useState('--:--:--')

  useEffect(() => {
    const t = setInterval(() => {
      setClock(new Date().toLocaleTimeString('uz-UZ'))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const st = STATUS[connStatus] || STATUS.connecting
  const deviceEntries = Object.entries(devices || {}).filter(([id]) => KNOWN_DEVICE_RE.test(id))

  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 px-4 py-3 rounded-xl border border-line bg-ink-850">
      <div>
        <p className="eyebrow">Qorli Tog' stansiyasi</p>
        <h1 className="text-[1.05rem] font-bold mt-0.5">Monitoring va arxiv ko'rsatkichi</h1>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="chip">
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
          {st.label}
        </span>
        {deviceEntries.map(([id, lastSeen]) => {
          const online = Date.now() - lastSeen < DEVICE_OFFLINE_MS
          const secondsAgo = Math.round((Date.now() - lastSeen) / 1000)
          return (
            <span key={id} className="chip" title={online ? '' : `${secondsAgo}s oldin ko'rildi`}>
              <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-ok' : 'bg-danger'}`} />
              {id} · {online ? 'onlayn' : 'oflayn'}
            </span>
          )
        })}
        <span className="chip font-mono">{clock}</span>
        <button type="button" onClick={onOpenRailVoltage} className="btn">
          Rels zanjirlari kuchlanishi
        </button>
        <button type="button" onClick={onOpenStats} className="btn">
          Statistika
        </button>
        <button type="button" onClick={onOpenArchive} className="btn">
          Arxiv
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className="btn"
          title={theme === 'dark' ? "Yorug' rejimga o'tish" : "Tungi rejimga o'tish"}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  )
}
