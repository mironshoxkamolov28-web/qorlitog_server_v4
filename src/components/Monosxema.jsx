import { useEffect, useRef, useState } from 'react'
import { normalizeSignalName } from '../utils/signalNames'

const TRACKS = [
  { name: '1ЧП',   left: 10,   top: 140,  w: 230, bg: 'rgb(216,204,204)', rot: '' },
  { name: '2СП',   left: 250,  top: 140,  w: 350, bg: 'rgb(177,163,163)', rot: '', switchPoints: [{ at: 470, sw: '2-4' }] },
  { name: 'IП',    left: 610,  top: 140,  w: 620, bg: 'rgb(177,163,163)', rot: '' },
  { name: '1СП',   left: 1240, top: 140,  w: 260, bg: 'rgb(177,163,163)', rot: '', switchPoints: [{ at: 1367, sw: '1' }] },
  { name: '1НП',   left: 1510, top: 140,  w: 290, bg: 'rgb(177,163,163)', rot: '' },
  // 4-6СП qatorida ikkita strelka nuqtasi bor: 4 (2 bilan spaeng) va 6 (mustaqil)
  { name: '4-6СП', left: 500, top: 260,  w: 260, bg: '', rot: '', switchPoints: [{ at: 538, sw: '2-4' }, { at: 680, sw: '6' }] },
  { name: 'IIП',   left: 770,  top: 260,  w: 320, bg: '', rot: '' },
  // 3-5СП: haqiqiy strelka 5 nuqtasi ≈1167 (pastdagi diagonal — 1110,320,
  // rot:-45deg — qatorga shu yerda tutashadi, xuddi 1-strelkadagi kabi
  // trigonometrik hisob bilan). Qator 1250'da tugaydi — aynan shu yerda
  // strelka 3'ning (demontaj qilingan, doim oddiy rangdagi) qoldiq yo'li
  // tutashadi, undan o'ngga hech narsa yo'q.
  { name: '3-5СП', left: 1100, top: 260,  w: 150, bg: '', rot: '', switchPoints: [{ at: 1167, sw: '5' }] },
  { name: 'IVП',   left: 801,  top: 380,  w: 249, bg: '', rot: '' },
  { name: '2СП',   left: 470,  top: 140,  w: 90,  bg: 'rgb(177,163,163)', rot: '45deg', sw: '2-4', pathType: 'side' },
  { name: '4-6СП', left: 680, top: 260,  w: 70,  bg: '', rot: '45deg', sw: '6', pathType: 'side' },
  { name: '4-6СП', left: 538, top: 213,  w: 65,  bg: '', rot: '45deg', sw: '2-4', pathType: 'side' },
  { name: '1СП',   left: 1310, top: 200,  w: 80,  bg: 'rgb(177,163,163)', rot: '-45deg', sw: '1', pathType: 'side' },
  // Strelka 3 demontaj qilingan — jismoniy yo'l qolgan, lekin strelka
  // mantig'i yo'q, shuning uchun sw/pathType'siz — oddiy 3-5SP rangida
  // (band/bo'sh) yonadi, hech qachon shtrix bo'lmaydi.
  { name: '3-5СП', left: 1250, top: 260,  w: 80,  bg: '', rot: '-45deg' },
  // Haqiqiy strelka 5'ning yo'li — pastdan (IVП tomondan) qatorga tutashadi
  { name: '3-5СП', left: 1110, top: 320,  w: 80,  bg: '', rot: '-45deg', sw: '5', pathType: 'side' },
  { name: 'IVП',   left: 1050, top: 380,  w: 75,  bg: '', rot: '-45deg' },
  { name: 'IVП',   left: 802,  top: 380,  w: 95,  bg: '', rot: '-135deg' },
]

const SIGNALS = [
  { name: 'N1',                              sigLeft: 570,  sigTop: 95,  labelLeft: 620,  labelTop: 90,  display: 'Н1',     type: '' },
  { name: 'N',                               sigLeft: 1460, sigTop: 95,  labelLeft: 1510, labelTop: 90,  display: 'Н',      type: '' },
  { name: 'N2',                              sigLeft: 715,  sigTop: 230, labelLeft: 770,  labelTop: 225, display: 'Н2',     type: '' },
  { name: 'N4',                              sigLeft: 800,  sigTop: 350, labelLeft: 850,  labelTop: 345, display: 'Н4',     type: '' },
  { name: 'Ч',                               sigLeft: 260,  sigTop: 160, labelLeft: 233,  labelTop: 155, display: 'Ч',      type: '' },
  { name: 'Ч1',                              sigLeft: 1220, sigTop: 160, labelLeft: 1180, labelTop: 155, display: 'Ч1',     type: '' },
  { name: 'Ч2',                              sigLeft: 1060, sigTop: 280, labelLeft: 1030, labelTop: 275, display: 'Ч2',     type: '' },
  { name: 'Ч4',                              sigLeft: 1025, sigTop: 400, labelLeft: 995,  labelTop: 395, display: 'Ч4',     type: '' },
  { name: 'ПС/ПП_Ч',    sigLeft: 2,   sigTop: 50,  labelLeft: 0,   labelTop: 70,  display: 'ПС/ПП', type: 'signal-arrow' },
  { name: 'КП_Ч',       sigLeft: 70,  sigTop: 0,   labelLeft: 70,  labelTop: 25,  display: 'КП',     type: 'signal-square' },
  { name: 'ДСО/ПП_Ч',   sigLeft: 110, sigTop: 50,  labelLeft: 110, labelTop: 70,  display: 'ДСО/ПП', type: 'signal-arrow' },
  { name: 'ПС/ПП_N',    sigLeft: 1660,sigTop: 50,  labelLeft: 1660,labelTop: 70,  display: 'ПС/ПП', type: 'signal-arrow' },
  { name: 'КП_N',       sigLeft: 1750,sigTop: 0,   labelLeft: 1750,labelTop: 25,  display: 'КП',     type: 'signal-square' },
  { name: 'ДСО/ПП_N',   sigLeft: 1800,sigTop: 50,  labelLeft: 1800,labelTop: 70,  display: 'ДСО/ПП', type: 'signal-arrow' },
]

const SWITCHES = [
  // Chap tomon (Buxoro) — 2 va 4 spaeng (sinxron) ishlaydi, 6 mustaqil
  { name: '2-4ПК', display: '+',  colorType: 'green',  sigLeft: 20,  sigTop: 470,  labelLeft: 25,  labelTop: 450 },
  { name: '2-4МК', display: '-',  colorType: 'yellow', sigLeft: 70,  sigTop: 470,  labelLeft: 75,  labelTop: 450 },
  { name: '6ПК',   display: '+',  colorType: 'green',  sigLeft: 160, sigTop: 470,  labelLeft: 165, labelTop: 450 },
  { name: '6МК',   display: '-',  colorType: 'yellow', sigLeft: 210, sigTop: 470,  labelLeft: 215, labelTop: 450 },
  // O'ng tomon (Miskent) — 1 mustaqil; 3 demontaj qilingan (endi mavjud emas); 5 mustaqil
  { name: '1ПК',  display: '+',  colorType: 'green',  sigLeft: 1640,sigTop: 470,  labelLeft: 1645,labelTop: 450 },
  { name: '1МК',  display: '-',  colorType: 'yellow', sigLeft: 1690,sigTop: 470,  labelLeft: 1695,labelTop: 450 },
  { name: '5ПК',  display: '+',  colorType: 'green',  sigLeft: 1770,sigTop: 470,  labelLeft: 1775,labelTop: 450 },
  { name: '5МК',  display: '-',  colorType: 'yellow', sigLeft: 1820,sigTop: 470,  labelLeft: 1825,labelTop: 450 },
]

const SWITCH_LABELS = [
  { text: '2-4', left: 45,  top: 420 },
  { text: '6',   left: 185, top: 420 },
  { text: '1',   left: 1665, top: 420 },
  { text: '5',   left: 1795, top: 420 },
]

const SECTIONS = [
  { name: '2СП',    left: 450,  top: 100, label: '2СП' },
  { name: '1ЧП',    left: 70,   top: 100, label: '1ЧП' },
  { name: '1НП',    left: 1600, top: 100, label: '1НП' },
  { name: '2СП',    left: 460,  top: 145, label: '2' },
  { name: '1СП',    left: 1370, top: 145, label: '1' },
  { name: 'IП',     left: 900,  top: 100, label: 'IП' },
  { name: '1СП',    left: 1350, top: 100, label: '1СП' },
  { name: '4-6СП', left: 620,  top: 220, label: '4-6СП' },
  { name: '4-6СП', left: 585,  top: 220, label: '4' },
  { name: 'IIП',    left: 900,  top: 220, label: 'IIП' },
  { name: '3-5СП',  left: 1130, top: 220, label: '3-5СП' },
  { name: '3-5СП',  left: 1170, top: 270, label: '5' },
  { name: '4-6СП', left: 670,  top: 270, label: '6' },
  { name: 'IVП',    left: 900,  top: 345, label: 'IVП' },
]

// Sxema shu o'lchov uchun chizilgan (Monosxema koordinatalari shunga mos) —
// kichikroq ekranlarda wrapper transform: scale() orqali shu nisbatda kichraytiradi.
const NATURAL_WIDTH = 1920
const NATURAL_HEIGHT = 560

function useAutoScale() {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      if (w > 0) setScale(Math.min(1, w / NATURAL_WIDTH))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return { containerRef, scale }
}

export default function Monosxema({ signalStates, isArchiveMode }) {
  const { containerRef, scale } = useAutoScale()

  const getState = (name) => {
    const norm = normalizeSignalName(name)
    return signalStates[norm] || 'red'
  }

  const isFree = (name) => getState(name) === 'green'

  const trackState = (t) => {
    if (t.sw && t.pathType === 'side') {
      const mk = getState(t.sw + 'МК') === 'green'
      const color = isFree(t.name) ? 'free' : 'busy'
      return mk ? color : color + ' dashed'
    }
    return isFree(t.name) ? 'free' : 'busy'
  }

  return (
    <section className="surface-panel rounded-xl relative mb-3.5 pt-3.5 px-3.5 pb-[18px]">
      <div className="mb-2">
        <p className="eyebrow">Monosxema</p>
      </div>

      <div ref={containerRef} style={{ width: '100%', height: NATURAL_HEIGHT * scale, overflow: 'hidden' }}>
        <div
          className={`station-map ${isArchiveMode ? 'archive' : ''}`}
          style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <h3 className="absolute left-[140px] top-5 font-bold text-[1rem] text-muted">Buxoro tomoni</h3>
          <h3 className="absolute right-[240px] top-5 font-bold text-[1rem] text-muted">Miskent tomoni</h3>

          {TRACKS.flatMap((t, i) => {
            /* Strelkali qator bir yoki bir nechta strelka nuqtasiga qarab
               bo'laklarga bo'linadi: har nuqtagacha bo'lgan birinchi qism —
               umumiy, strelka holatidan qat'i nazar har doim yonadi; undan
               keyingi har bir qism esa o'zidan oldingi strelka to'g'riga
               (ПК/+) qo'yilgan bo'lsagina yonadi, aks holda shtrix. Ketma-ket
               ikkita strelkasi bor qator (masalan 4-6СП: 4 va 6) uch qismga
               bo'linadi. */
            if (t.switchPoints && t.switchPoints.length > 0) {
              const color = isFree(t.name) ? 'free' : 'busy'
              const bounds = [t.left, ...t.switchPoints.map(p => p.at), t.left + t.w]
              const lastSeg = bounds.length - 2
              return bounds.slice(0, -1).map((segLeft, k) => {
                const segW = bounds[k + 1] - segLeft
                let cls = color
                if (k > 0) {
                  const pk = getState(t.switchPoints[k - 1].sw + 'ПК') === 'green'
                  if (!pk) cls += ' dashed'
                }
                const style = { left: segLeft, top: t.top, width: segW }
                if (k > 0) { style.borderTopLeftRadius = 0; style.borderBottomLeftRadius = 0 }
                if (k < lastSeg) { style.borderTopRightRadius = 0; style.borderBottomRightRadius = 0 }
                return <div key={`track-${i}-${k}`} className={`track ${cls}`} style={style} />
              })
            }
            return [
              <div
                key={`track-${i}`}
                className={`track ${trackState(t)}`}
                style={{
                  left: t.left,
                  top: t.top,
                  width: t.w,
                  transform: t.rot ? `rotate(${t.rot})` : undefined
                  /* Eslatma: inline backgroundColor olib tashlandi — inline stil
                     .free/.busy klass ranglaridan har doim ustun bo'lib,
                     yo'l rangi holatga qarab o'zgarmay qolardi. */
                }}
              />
            ]
          })}

          {SIGNALS.map((s, i) => (
            <div key={`sig-${i}`}>
              {/* ПС/ПП, КП, ДСО/ПП (type bor) — ikki holatli indikatorlar:
                  ESP32 pinida signal BOR  -> "green" yuboriladi -> QIZIL yonadi
                  ESP32 pinida signal YO'Q -> "red"   yuboriladi -> SARIQ yonadi
                  Yashil bu indikatorlarda umuman ishlatilmaydi. */}
              <div
                className={`signal ${s.type} ${s.type ? (getState(s.name) === 'red' ? 'yellow' : 'red') : getState(s.name)}`}
                data-state={getState(s.name)}
                style={{ left: s.sigLeft, top: s.sigTop }}
              />
              <span className="name" style={{ left: s.labelLeft, top: s.labelTop }}>
                {s.display}
              </span>
            </div>
          ))}

          {SWITCHES.map((s, i) => (
            <div key={`sw-${i}`}>
              <div
                className={`signal signal-switch ${getState(s.name) === 'green' ? s.colorType : ''}`}
                data-state={getState(s.name)}
                style={{ left: s.sigLeft, top: s.sigTop }}
              />
              <span className="switch-label" style={{ left: s.labelLeft, top: s.labelTop }}>
                {s.display}
              </span>
            </div>
          ))}

          {SWITCH_LABELS.map((sl, i) => (
            <span key={`swl-${i}`} className="section" style={{ left: sl.left, top: sl.top }}>
              {sl.text}
            </span>
          ))}

          <div
            className={`archive-marker ${isArchiveMode ? 'is-archive' : ''}`}
            style={{ left: '50%', transform: 'translateX(-50%)' }}
          >
            {isArchiveMode ? 'Arxiv' : 'Live'}
          </div>

          {SECTIONS.map((sec, i) => (
            <span
              key={`sec-${i}`}
              className={`section ${isFree(sec.name) ? 'free' : 'busy'}`}
              style={{ left: sec.left, top: sec.top }}
            >
              {sec.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
