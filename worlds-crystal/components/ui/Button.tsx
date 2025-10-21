import * as React from "react";
import clsx from "clsx";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  isLoading?: boolean;
};

const base =
  "inline-flex items-center justify-center rounded-xl border transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed select-none";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "border-transparent bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[.98] " +
    "focus-visible:ring-indigo-500",
  secondary:
    "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 active:scale-[.98] " +
    "focus-visible:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700",
  ghost:
    "border-transparent bg-transparent text-zinc-900 hover:bg-zinc-100 active:scale-[.98] " +
    "focus-visible:ring-zinc-400 dark:text-zinc-100 dark:hover:bg-zinc-800",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-base",
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  isLoading,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={clsx(base, variants[variant], sizes[size], "cursor-pointer", className)}
      {...props}
    >
      {isLoading ? (
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
