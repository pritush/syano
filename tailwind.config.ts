import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  darkMode: 'class',
  content: [
    './app.vue',
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './server/**/*.{ts,js}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#092327',
        lagoon: '#0b5351',
        mist: '#d5eeed',
        sand: '#f7f7f2',
        coral: '#ff6b6b',
      },
      boxShadow: {
        float: '0 24px 80px rgba(11, 83, 81, 0.18)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
}

