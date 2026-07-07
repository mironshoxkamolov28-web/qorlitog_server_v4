 /** @type {import('tailwindcss').Config} */
// Dizayn tokenlari — "dispetcher pulti" uslubi:
// rang FAQAT signal holatlarida (ok/warn/danger, rail-*), qolgan hammasi neytral.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0d1117', // svetofor korpusi
          900: '#10151b', // sahifa foni / monosxema maydoni
          850: '#141920', // panel
          800: '#181d24', // karta (ichki blok)
        },
        control: '#1b222b', // tugma/input foni
        edge: '#2b323c',    // tugma/input chegarasi
        accent: '#8b9bad',  // eyebrow (neytral!)
        sky2: '#c7d0da',
        muted: '#9aa5b1',
        muted2: '#7d8896',
        ok: '#34c759',
        warn: '#f0b429',
        danger: '#e5484d',
      },
      borderColor: {
        line: '#232a33',
      },
      boxShadow: {
        // Flat uslub — og'ir soyalar olib tashlandi
        panel: 'none',
        card: 'none',
      },
      fontFamily: {
        sans: ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
