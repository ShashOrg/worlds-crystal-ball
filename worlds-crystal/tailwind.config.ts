import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  theme: {
    extend: {
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)",
        cardHover: "0 6px 20px rgba(0,0,0,0.18)",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(.22,.61,.36,1)",
      },
    },
  },
};

export default config;
