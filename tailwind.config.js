/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontSize: { base: '14.5px' },
      boxShadow: { soft: '0 1px 3px rgba(0,0,0,0.08), 0 4px 14px rgba(0,0,0,0.06)' }
    }
  },
  plugins: []
};
