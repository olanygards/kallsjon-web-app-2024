/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{jsx,tsx}",
    "./index.html"
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#fbfbf9',
          surface: '#ffffff',
          'surface-elevated': '#f3f3f1',
          border: '#e0e0dc',
          'border-muted': '#ececea',
          text: '#1c1c1c',
          muted: '#6b6b6b',
          subtle: '#9a9a9a',
          accent: '#0F3D9E',
          'accent-green': '#00813E',
          'nav-bg': '#1c1c1c',
          'nav-muted': '#9a9a9a',
          'nav-active': '#000000',
        },
        'kallsjon-blue': '#0036a7',
        'kallsjon-gray': '#f3f4f6',
        'kallsjon-lt-green': 'rgb(151 183 166)',
        'kallsjon-lt-green-light': 'rgb(218, 244, 230)',
        'kallsjon-green': 'rgb(174 208 175)',
        'kallsjon-green-dark': 'rgb(38 79 34)',
      }
    },
  },
  plugins: [],
}
