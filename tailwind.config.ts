import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
        body: ['var(--font-body)'],
      },
      colors: {
        plasma: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          900: '#0c4a6e',
        },
        field: {
          dark: '#080c14',
          mid: '#0d1526',
          card: '#111827',
          border: '#1e3a5f',
        },
        accent: {
          cyan: '#00f5ff',
          gold: '#ffd700',
          rose: '#ff4d6d',
          green: '#39ff14',
        }
      }
    },
  },
  plugins: [],
}
export default config
