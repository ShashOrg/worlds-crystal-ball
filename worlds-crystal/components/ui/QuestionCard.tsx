import { ReactNode, KeyboardEvent } from "react";

import { cn } from "@/lib/cn";

type Props = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  titleId?: string;
  "data-testid"?: string;
};

export default function QuestionCard({
  title,
  subtitle,
  children,
  className,
  selected = false,
  disabled = false,
  onClick,
  href,
  titleId,
  ...rest
}: Props) {
  const isInteractive = Boolean(onClick || href);
  const { role: roleProp, ...restProps } = rest as { role?: string };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLDivElement | HTMLAnchorElement>,
  ) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  };

  const sharedProps = {
    onClick: disabled ? undefined : onClick,
    onKeyDown: onClick && !disabled ? handleKeyDown : undefined,
    tabIndex: disabled ? -1 : isInteractive ? 0 : undefined,
    role: isInteractive ? "button" : roleProp ?? "group",
    "aria-pressed": isInteractive && selected ? true : undefined,
    "aria-disabled": disabled || undefined,
    className: cn(
      "group relative rounded-2xl border bg-white/80 shadow-sm ring-1 ring-black/[0.06]",
      "p-4 sm:p-5 md:p-6",
      "text-neutral-800",
      "transition-all duration-200 ease-out",
      !disabled && "hover:shadow-md hover:-translate-y-[1px]",
      !disabled && "active:translate-y-0 active:shadow-sm",
      !disabled &&
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500",
      selected && "ring-2 ring-indigo-500 shadow-md",
      disabled && "opacity-60 cursor-not-allowed",
      "dark:bg-neutral-900/70 dark:text-neutral-100 dark:border-neutral-800 dark:ring-white/[0.06]",
      !disabled && "dark:hover:shadow-md",
      selected && "dark:ring-indigo-400",
      className
    ),
    ...restProps,
  };

  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 -top-px h-10 rounded-t-2xl",
          "bg-gradient-to-b from-black/[0.06] to-transparent",
          "dark:from-white/[0.06]"
        )}
      />
      <div className="flex items-start gap-3">
        <div className="shrink-0 hidden sm:block">
          <div
            className={cn(
              "h-9 w-9 rounded-xl border",
              selected
                ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-900"
                : "bg-neutral-50 border-neutral-200 dark:bg-neutral-800/60 dark:border-neutral-700",
              "grid place-items-center text-xs font-semibold text-neutral-500 dark:text-neutral-300"
            )}
          >
            ?
          </div>
        </div>
        <div className="min-w-0">
          <h3
            id={titleId}
            className="text-base font-semibold leading-6 tracking-tight text-neutral-900 dark:text-neutral-50"
          >
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {children && (
        <div className="mt-4 text-sm text-neutral-700 dark:text-neutral-200">
          {children}
        </div>
      )}

      {!disabled && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-2xl",
            "ring-0 ring-indigo-400/0 group-hover:ring-4 group-hover:ring-indigo-400/15",
            "transition-all duration-200 ease-out"
          )}
        />
      )}
    </>
  );

  if (href) {
    return (
      <a href={href} {...sharedProps}>
        {content}
      </a>
    );
  }

  return <div {...sharedProps}>{content}</div>;
}
