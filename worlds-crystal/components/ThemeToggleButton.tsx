"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Button } from "./ui/Button";

export default function ThemeToggleButton() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const isDark = (resolvedTheme ?? theme) === "dark";

  return (
    <Button
      variant="secondary"
      size="sm"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={`Toggle ${isDark ? "Light" : "Dark"} Mode`}
    >
      {mounted ? (isDark ? "🌙 Dark" : "☀️ Light") : "…"}
    </Button>
  );
}
