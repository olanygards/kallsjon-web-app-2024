/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{jsx,tsx}",  // Bara JavaScript/TypeScript React-filer
    "./index.html"
  ],
  theme: {
    extend: {
      colors: {
        'kallsjon-blue': '#1e3a8a',
        'kallsjon-gray': '#f3f4f6',
      }
    },
  },
  plugins: [],
}