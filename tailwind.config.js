import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agri: {
          50: '#f2fcf5',
          100: '#e1f8e8',
          200: '#c3efd2',
          300: '#94e0b3',
          400: '#5cc78e',
          500: '#34ab6f',
          600: '#268a57',
          700: '#216e48',
          800: '#1d573b',
          900: '#194833',
        },
        earth: {
          50: '#faf8f6',
          100: '#f3efea',
          200: '#e5ddd3',
          300: '#d1c2b0',
          400: '#bba28a',
          500: '#a68568',
          600: '#8d6d53',
          700: '#725644',
          800: '#5f483b',
        }
      }
    }
  },
  plugins: [animate]
};
