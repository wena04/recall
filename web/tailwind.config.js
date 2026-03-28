import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind v4 uses CSS-first config via @import and @theme in index.css.
  // Keep a minimal config for editor tooling and fallback compatibility.
  darkMode: 'class',
  content: [path.join(__dirname, 'src/**/*.{js,ts,jsx,tsx}')],
  theme: {
    extend: {},
  },
  plugins: [],
}
