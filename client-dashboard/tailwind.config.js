/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0d9488",
        secondary: "#115e59",
        accent: "#0d9488",
        success: "#16a34a",
        error: "#dc2626",
      }
    },
  },
  plugins: [],
}
