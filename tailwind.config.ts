import type { Config } from "tailwindcss";

/*
 * Nagrik theme: peach + light saffron.
 * - `slate` is remapped to warm peach neutrals, so every existing grey surface,
 *   border and text colour in the app shifts to the warm palette together.
 * - `brand` is saffron (was blue), so primary buttons/links become saffron.
 * - Dark mode only applies with an explicit `.dark` class (never set), so the app
 *   is always the light peach theme, even on dark-mode devices.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-mukta)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "Times New Roman", "serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Warm peach neutrals (replaces cool grey)
        slate: {
          50: "#FFF7F1",
          100: "#FFEDE0",
          200: "#F8DCC8",
          300: "#EEC6AA",
          400: "#B8907A",
          500: "#8E6A55",
          600: "#735341",
          700: "#5A3F31",
          800: "#432E23",
          900: "#2F1F17",
          950: "#20140E",
        },
        // Saffron
        brand: {
          50: "#FFF6E8",
          100: "#FFE9C7",
          200: "#FFD699",
          300: "#FFC266",
          400: "#FFAE3D",
          500: "#F7941D",
          600: "#C46A00",
          700: "#9E5500",
          800: "#7A4206",
          900: "#5E340A",
          950: "#341B03",
        },
        peach: {
          50: "#FFF7F1",
          100: "#FFEDE0",
          200: "#FFDFC9",
          300: "#FFCFAE",
          400: "#FDB98F",
        },
        saffron: {
          DEFAULT: "#F7941D",
          light: "#FFAE3D",
          deep: "#C46A00",
        },
        cocoa: { DEFAULT: "#2F1F17", soft: "#735341" },
        civic: {
          orange: "#f97316",
          emerald: "#10b981",
          amber: "#f59e0b",
          red: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};

export default config;
