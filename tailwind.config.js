/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "hsl(210 20% 98%)",
          card: "hsl(0 0% 100%)",
          muted: "hsl(210 15% 96%)",
        },
        ink: {
          DEFAULT: "hsl(222 47% 11%)",
          muted: "hsl(215 16% 42%)",
        },
        accent: {
          income: "hsl(152 60% 38%)",
          expense: "hsl(350 65% 48%)",
          net: "hsl(221 83% 48%)",
        },
      },
      boxShadow: {
        card: "0 1px 3px hsl(222 47% 11% / 0.06), 0 4px 12px hsl(222 47% 11% / 0.04)",
      },
    },
  },
  plugins: [],
};
