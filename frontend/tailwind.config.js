/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Microsoft-inspired palette
        ms: {
          blue: '#0078d4',
          'blue-dark': '#005a9e',
          'blue-light': '#50b0f0',
          purple: '#8661c5',
          teal: '#038387',
          green: '#107c10',
          orange: '#d83b01',
          red: '#a4262c',
          yellow: '#fce100',
          gray: {
            50: '#faf9f8',
            100: '#f3f2f1',
            200: '#edebe9',
            300: '#d2d0ce',
            400: '#a19f9d',
            500: '#605e5c',
            600: '#484644',
            700: '#323130',
            800: '#201f1e',
            900: '#11100f',
          },
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Cascadia Code"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      animation: {
        'cursor-blink': 'blink 1s step-end infinite',
        'fade-in': 'fadeIn 0.2s ease-in',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        blink: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { transform: 'translateX(-8px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
}
