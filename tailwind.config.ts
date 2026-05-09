import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#182335",
        field: "#f3f7fb",
        line: "#d7e2ee",
        action: "#1267b3",
        warn: "#b25a18"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(20, 72, 123, 0.09)"
      }
    }
  },
  plugins: []
};

export default config;
