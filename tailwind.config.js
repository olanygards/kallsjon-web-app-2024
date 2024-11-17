/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{jsx,tsx}",  // Bara JavaScript/TypeScript React-filer
    "./index.html"
  ],
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