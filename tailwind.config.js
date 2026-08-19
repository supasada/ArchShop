/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        arch: {
          black: '#0d0e12',
          dark: '#16181e',
          gray900: '#1f232b',
          gray800: '#2b313d',
          gray700: '#3f4756',
          gray200: '#e2e5eb',
          gray100: '#f1f3f7',
          accent: '#ff4d00',
          cyan: '#00d2ff',
          gold: '#e5a93c'
        }
      },
      fontFamily: {
        thai: ['Prompt', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Space Grotesk', 'Prompt', 'sans-serif']
      }
    },
  },
  plugins: [],
}
