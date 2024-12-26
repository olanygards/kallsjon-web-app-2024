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
        'kallsjon-green': '#008000',
      }
    },
  },
  plugins: [],
}