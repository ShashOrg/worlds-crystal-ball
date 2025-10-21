"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "./ui/Button";

export default function ThemeToggleButton() {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  const currentTheme = mounted ? resolvedTheme ?? theme : undefined;
  const isDark = currentTheme === "dark";

  const ariaLabel = mounted
    ? `Switch to ${isDark ? "light" : "dark"} mode`
    : "Toggle color theme";

  const title = mounted
    ? `Switch to ${isDark ? "Light" : "Dark"} Mode`
    : "Toggle Theme";

  const ariaPressed = mounted ? isDark : false;

  const handleClick = () => {
    if (!mounted) return;
    setTheme(isDark ? "light" : "dark");
  };

  const Icon = isDark ? Sun : Moon;

  return (
    <Button
      variant="secondary"
      size="sm"
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      title={title}
      onClick={handleClick}
      type="button"
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline" suppressHydrationWarning>
          {mounted ? `${isDark ? "Light" : "Dark"} Mode` : "Theme"}
        </span>
      </span>
    </Button>
  );
}
