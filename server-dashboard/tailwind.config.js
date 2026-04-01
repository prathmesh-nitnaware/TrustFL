/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1e293b",
        secondary: "#475569",
        accent: "#2563eb",
        success: "#16a34a",
        error: "#dc2626",
      }
    },
  },
  plugins: [],
}
