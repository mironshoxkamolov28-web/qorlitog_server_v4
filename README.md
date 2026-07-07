# Qorli Tog' Stansiyasi — yangilangan (Tailwind + tuzatishlar)

## Nima o'zgardi

### Tuzatilgan xatolar
1. **server.js endi ishga tushadi.** Avval `require('./signalNames')` topilmasdan qulardi.
   Endi server ESM (`import`) ga o'tkazildi va `signalNames` to'g'ri yo'ldan
   (`./src/utils/signalNames.js`) import qilinadi. `ws` ham dinamik import.
4. **Production sahifa ochiladi.** Avval server `dist/` o'rniga ildizdagi dev
   `index.html` ni berardi (bo'sh sahifa). Endi server `dist/` dan beradi va
   topilmagan yo'llar React-ga (SPA fallback) qaytariladi. `dist/` yo'q bo'lsa
   "`npm run build` qiling" ogohlantirishi chiqadi.

### Tailwind
- Joylashuv, kartalar, panellar, tipografika, grid va responsivlik — Tailwind utility klasslari.
- Monosxema shakllari (svetofor, strelka, yo'l — `::before/::after`, `clip-path`, glow)
  `src/index.css` ichida `@layer components` da saqlandi. Bularni sof utility bilan
  ifodalab bo'lmaydi; `Monosxema.jsx` mantig'i aynan shu klass nomlariga tayanadi.
- Dizayn tokenlari `tailwind.config.js` da (ranglar, soyalar, chegara rangi).
- Eski `src/App.css` o'chirildi; o'rniga `src/index.css`.

## Ishga tushirish

```bash
npm install        # ws, tailwindcss, postcss, autoprefixer ham o'rnatiladi
npm run build      # React -> dist/
npm start          # = node server.js  (http://localhost:3000)
```

Yoki ishlab chiqish rejimida (ikki terminal):
```bash
npm start          # backend: 3000-port
npm run dev        # frontend: 5173-port (proxy orqali 3000 ga ulanadi)
```

## Eslatma
- WebSocket (real vaqt) endi `ws` dependency sifatida qo'shildi. O'rnatilsa, jonli
  yangilanish ishlaydi; bo'lmasa 5 soniyalik polling.

## Yangi tuzatishlar (02.07.2026)

1. **Arxiv vaqt formati (2-xato) tuzatildi.** Server Node'da `toLocaleString('uz-UZ')`
   `"02/07/2026, 14:05:09"` (VERGUL bilan) qaytaradi, frontend regexi esa vergulni
   qabul qilmasdi — natijada arxiv rejimi UMUMAN ishlamasdi. Endi:
   - server har bir yozuvga `ts` (epoch ms) qo'shadi — hisob-kitob shu orqali;
   - `time` faqat ko'rsatish uchun;
   - eski yozuvlar uchun regex vergulga chidamli + ISO fallback.
2. **Arxiv rejimini jonli ma'lumot buzmaydi.** `useWebSocket` dagi eskirgan closure
   tufayli 5s polling va WS xabarlari arxiv snapshot ustidan yozib yuborardi.
   Endi `isArchiveMode` ref orqali o'qiladi; arxiv ro'yxati yangilanaveradi,
   monosxema esa faqat Live rejimda yangilanadi.
3. **Yo'l ranglari tuzatildi.** `linear-gradient(90deg, red)` (bitta rangli) CSS
   bo'yicha noto'g'ri — butun `background` bekor bo'lardi. Endi 2 rangli gradient.
   Track'lardagi inline `backgroundColor` ham olib tashlandi (u klass rangini
   har doim yengib, yo'l holat rangiga bo'yalmay qolardi).
4. **Kirill/lotin harflar normalizatsiyasi kengaytirildi.** ESP32 lotin C/A/K/M/H/P
   yuborsa ham kanonik kirill/N ko'rinishga keltiriladi. Boshlang'ich kalitlardagi
   kirill `Н` li "o'lik" kalitlar ham normalizatsiya qilindi (server + frontend).
5. **ESP32 `device` maydoni.** `/api/update` ga `device` yuborilsa, arxiv yozuvida
   qaysi kontrollerdan kelgani saqlanadi (2 ta ESP32 ni ajratish uchun).
6. **Arxiv limiti 200 -> 2000** (`ARCHIVE_LIMIT` konstantasi, server.js).
7. **package.json:** `@tailwindcss/vite` (v4) olib tashlandi — u Tailwind v3 +
   PostCSS sozlamasi bilan ziddiyatda edi.

## ESP32 protokoli (qisqa)

`POST http://<server-ip>:3000/api/update` (JSON):

```json
{ "name": "2СП", "state": "green", "device": "esp32-1" }
```
yoki bir nechta hodisa birdaniga:
```json
{ "device": "esp32-2", "events": [
  { "name": "1НП", "state": "green" },
  { "name": "3-5МК", "state": "red" }
] }
```
yoki to'liq xarita:
```json
{ "signals": { "Ч1": "green", "N4": "red" }, "device": "esp32-1" }
```
`state` qiymatlari: `"green"` (ochiq/plus) yoki `"red"` (band). Vaqtni server
o'zi qo'yadi (`ts`), ESP32 dan NTP talab qilinmaydi.

### ПС/ПП, КП, ДСО/ПП indikatorlari (maxsus konvensiya)

Bu uchtasi ikki holatli indikator, yashil ular uchun ishlatilmaydi:

| ESP32 pinida    | JSON'da yuboriladi | Ekranda yonadi |
|-----------------|--------------------|----------------|
| Signal BOR      | `"state": "green"` | 🔴 Qizil       |
| Signal YO'Q     | `"state": "red"`   | 🟡 Sariq       |

Nomlar tomonga qarab ajratiladi: `ПС/ПП_Ч`, `КП_Ч`, `ДСО/ПП_Ч` (Buxoro tomoni)
va `ПС/ПП_N`, `КП_N`, `ДСО/ПП_N` (Miskent tomoni).

## Dizayn yangilanishi (02.07.2026)

"Dispetcher pulti" uslubi: flat, gradientsiz, glow'siz. Asosiy qoidalar:
- **Monosxemadagi barcha joylashuvlar, o'lchamlar va shakllar standart bo'yicha
  o'zgarmagan** — `Monosxema.jsx` koordinatalari avvalgidek.
- Rang faqat signal holatlarida: yashil `#34c759` / `#3fa863`, qizil `#e5484d` /
  `#d64545`, sariq `#f0b429`. Interfeys qolgan qismi neytral to'q kulrang.
- Emoji o'rniga indikator nuqtalar; raqamlar/vaqt monospace (tizim shrifti —
  internetsiz lokal tarmoqda ham ishlaydi).
- Ulanish holati endi kod bilan yuriladi (`connecting`/`online`/`reconnecting`),
  ko'rinish `HeroBar.jsx` da.
- Arxiv rejimida sxema chegarasi va marker sariq rangga o'tadi.
- Arxiv jadvaliga "Qurilma" ustuni qo'shildi (`device` maydoni bo'lsa ko'rinadi).
- Barcha dizayn tokenlari `tailwind.config.js` da.

## Muammolarni aniqlash (02.07.2026 yangilanishi)

Server endi har bir kelgan so'rovni terminalga yozadi va ko'proq formatlarni qabul qiladi:
- Holat qiymatlari: `green/red`, `GREEN/RED`, `1/0`, `true/false`, `on/off`,
  `high/low`, `yashil/qizil`, `ochiq/band`, `+/-` — hammasi kanonik green/red ga aylanadi.
- Kalit nomlari: `name` o'rniga `signal`, `id`; `state` o'rniga `value`, `status`, `holat` ham bo'ladi.
- POST JSON dan tashqari: form-encoded (`name=X&state=Y`) va GET
  (`/api/update?name=X&state=Y`) ham ishlaydi. GET'da kirill nomlar
  URL-encode qilinishi shart — shuning uchun POST JSON tavsiya etiladi.
- Format tanilmasa server 400 + aniq xabar qaytaradi va terminalga
  "⚠ name/state kaliti topilmadi. Kelgan kalitlar: ..." deb yozadi.

**"Ma'lumot kelyapti, lekin monosxema o'zgarmayapti" bo'lsa tartib bilan tekshiring:**
1. Yangi `server.js` bilan serverni qayta ishga tushiring, ESP32 signal berganda
   terminalga qarang:
   - `✓ qabul qilindi: 2СП→green` — server tomoni ishlayapti, muammo frontendda
     (eski build!): `npm run build` qilib, brauzerda Ctrl+F5 bosing.
   - `⚠ name/state kaliti topilmadi` — ESP32 boshqa formatda yubormoqda,
     terminaldagi qatorga qarab firmware'ni moslang.
   - Terminalga umuman hech narsa tushmasa — so'rov serverga yetib kelmayapti:
     ESP32 dagi URL/IP/port (3000) ni tekshiring.
2. Frontendsiz tekshiruv: brauzerda `http://<server-ip>:3000/api/status` oching —
   ESP32 signal berganda sahifani yangilang, `signals` o'zgarsa server OK.

## Hali ochiq masalalar
- `/api/update` da autentifikatsiya yo'q — lokal tarmoqdagi istalgan qurilma
  yozishi mumkin. Oddiy token tekshiruvi qo'shish tavsiya etiladi.
- Arxiv 2000 yozuvdan oshsa eng eskilari o'chadi — juda eski vaqt uchun snapshot
  chiqmasligi mumkin.
