/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#090e1a',
          800: '#0d1424',
          700: '#111b2e',
          600: '#172236',
          500: '#1e2d45',
        },
        accent: {
          DEFAULT: '#3b82f6',
          dim: '#1d4ed8',
          glow: '#60a5fa',
        },
        muted: '#4b5e7a',
        border: '#1e2d45',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
