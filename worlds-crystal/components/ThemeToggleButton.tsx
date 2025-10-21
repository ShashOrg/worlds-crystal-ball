"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Button } from "./ui/Button";

export default function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  const isLight = mounted ? resolvedTheme === "light" : false;

  const ariaLabel = mounted
    ? isLight
      ? "Switch to dark mode"
      : "Switch to light mode"
    : "Toggle color theme";

  const title = mounted
    ? isLight
      ? "Switch to Dark Mode"
      : "Switch to Light Mode"
    : "Toggle Theme";

  const ariaPressed = mounted ? isLight : false;

  const handleClick = () => {
    if (!mounted) return;
    setTheme(isLight ? "dark" : "light");
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      title={title}
      onClick={handleClick}
    >
      {mounted ? (isLight ? "🌙" : "☀️") : "◐"}
    </Button>
  );
}
