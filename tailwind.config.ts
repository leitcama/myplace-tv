import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0B0F14",
        accent: "#60A5FA"
      },
      textColor: {
        glow: "rgba(255,255,255,0.9)"
      },
      boxShadow: {
        screen: "0 20px 60px rgba(0,0,0,0.6)"
      }
    }
  },
  plugins: []
} satisfies Config;