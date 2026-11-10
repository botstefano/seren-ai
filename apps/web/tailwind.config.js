/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        line: "#e8eae3",
        ink: "#1f302c",
        muted: "#71807a",
        canvas: "#f7f7f2",
        forest: "#24463d",
        sage: "#dce8df",
        gold: "#c39a63",
        clay: "#c87962",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Manrope", "sans-serif"],
      },
      boxShadow: {
        soft: "0 12px 34px rgba(31, 48, 44, 0.06)",
      },
    },
  },
  plugins: [],
};
