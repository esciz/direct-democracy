import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./types/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        civic: {
          50: "#f1f5f9",
          100: "#e2e8f0",
          200: "#cbd5e1",
          300: "#94a3b8",
          500: "#2563eb",
          700: "#1d4ed8",
          900: "#0f172a"
        },
        signal: "#f97316"
      },
      boxShadow: {
        card: "0 18px 40px -24px rgba(15, 23, 42, 0.35)"
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at top, rgba(37, 99, 235, 0.14), transparent 28%), linear-gradient(rgba(15, 23, 42, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.04) 1px, transparent 1px)"
      },
      backgroundSize: {
        "hero-grid": "auto, 32px 32px, 32px 32px"
      }
    }
  },
  plugins: [],
};

export default config;
