"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!mounted) return null;

  const isDark = (theme ?? resolvedTheme) === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={[
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 font-medium",
        "transition-colors duration-200",
        "border border-neutral-300 dark:border-neutral-600",
        "bg-neutral-100 hover:bg-neutral-200",
        "dark:bg-neutral-700 dark:hover:bg-neutral-600",
        "text-neutral-800 dark:text-neutral-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
      ].join(" ")}
      title="Toggle theme"
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4" />
          Light mode
        </>
      ) : (
        <>
          <Moon className="h-4 w-4" />
          Dark mode
        </>
      )}
    </button>
  );
}
