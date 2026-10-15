/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tomato: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#D7263D', // Core requested tomato red
          800: '#9f1239',
          900: '#881337',
          DEFAULT: '#D7263D',
        },
        mandi: {
          bg: '#f8fafc',
          card: '#ffffff',
          dark: '#0f172a',
          sidebar: '#1e293b',
          border: '#e2e8f0',
        }
      },
      fontFamily: {
        sans: ['"Noto Sans Tamil"', '"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        tamil: ['"Noto Sans Tamil"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
