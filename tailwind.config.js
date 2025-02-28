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
        'kallsjon-blue': '#0036a7',
        'kallsjon-gray': '#f3f4f6',
        'kallsjon-lt-green': 'rgb(151 183 166)',
        'kallsjon-green': 'rgb(174 208 175)',
        'kallsjon-green-dark': 'rgb(38 79 34)',
      }
    },
  },
  plugins: [],
}