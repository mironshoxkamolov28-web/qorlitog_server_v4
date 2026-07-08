 /** @type {import('tailwindcss').Config} */
// Dizayn tokenlari — "dispetcher pulti" uslubi:
// rang FAQAT signal holatlarida (ok/warn/danger, rail-*), qolgan hammasi neytral.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // CSS o'zgaruvchilariga ishora — qiymatlar index.css'dagi
        // :root / :root[data-theme="light"] bloklarida (dark/light rejim).
        ink: {
          950: 'var(--ink-950)', // svetofor korpusi
          900: 'var(--ink-900)', // sahifa foni / monosxema maydoni
          850: 'var(--ink-850)', // panel
          800: 'var(--ink-800)', // karta (ichki blok)
        },
        control: 'var(--control)', // tugma/input foni
        edge: 'var(--edge)',       // tugma/input chegarasi
        accent: 'var(--accent)',   // eyebrow (neytral!)
        sky2: 'var(--sky2)',
        muted: 'var(--muted)',
        muted2: 'var(--muted2)',
        strong: 'var(--text-strong)',
        strongest: 'var(--text-strongest)',
        ok: '#34c759',
        warn: '#f0b429',
        danger: '#e5484d',
      },
      borderColor: {
        line: 'var(--line)',
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
