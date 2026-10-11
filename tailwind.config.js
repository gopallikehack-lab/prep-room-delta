/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14213D",
        paper: "#F7F5F0",
        accent: "#0E7C7B",
        accentDark: "#0A5C5B",
        line: "#E3DFD5",
        muted: "#5F6B7A",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
