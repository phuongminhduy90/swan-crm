import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        swan: {
          50: "#E6F7F9",
          100: "#CCF0F3",
          200: "#99E1E7",
          300: "#66D1DB",
          400: "#33C2CF",
          500: "#00ADBE",
          600: "#0096A8",
          700: "#007A8C",
          800: "#005E6D",
          900: "#00424E",
        },
        champagne: {
          50: "#FBF7EE",
          100: "#F5EDD6",
          200: "#ECDFB8",
          300: "#E2D098",
          400: "#D4B87A",
          500: "#C9A96E",
          600: "#B8965A",
          700: "#95794A",
          800: "#6F5A38",
          900: "#4A3C25",
        },
        cream: "#FFF9F0",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        medium: "0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)",
        elevated: "0 4px 16px rgba(0,0,0,0.08), 0 12px 40px rgba(0,0,0,0.06)",
        "glow-swan": "0 0 0 4px rgba(0, 173, 190, 0.12)",
        "glow-champagne": "0 0 0 4px rgba(201, 169, 110, 0.15)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "shrink": {
          from: { width: "100%" },
          to: { width: "0%" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "slide-up": "slide-up 240ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-down": "slide-down 240ms cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "shimmer": "shimmer 2s linear infinite",
        "shrink": "shrink 3.5s linear forwards",
      },
      backgroundImage: {
        "gradient-swan": "linear-gradient(135deg, #00ADBE 0%, #0096A8 100%)",
        "gradient-champagne": "linear-gradient(135deg, #D4B87A 0%, #C9A96E 100%)",
        "gradient-page": "linear-gradient(135deg, #FFF9F0 0%, #FFFFFF 50%, #E6F7F9 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
