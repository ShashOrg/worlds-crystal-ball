import * as React from "react";

type QuestionCardBaseProps = React.PropsWithChildren<{
  title: string;
  subtitle?: string;
  onClick?: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  as?: "button" | "div";
  className?: string;
}>;

type QuestionCardProps = QuestionCardBaseProps &
  Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "onClick" | "onKeyDown" | "children" | "className"
  >;

export default function QuestionCard({
  title,
  subtitle,
  children,
  onClick,
  onKeyDown,
  as = "div",
  className = "",
  ...rest
}: QuestionCardProps) {
  const Comp = (as ?? "div") as React.ElementType;

  const combinedClassName = [
    "group relative rounded-2xl",
    "bg-neutral-100/90 dark:bg-neutral-800/80",
    "border border-neutral-200/80 dark:border-neutral-700/70",
    "shadow-card hover:shadow-cardHover transition-all duration-200 ease-soft",
    "hover:-translate-y-[2px] active:translate-y-[0px]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400",
    "p-4 sm:p-5 md:p-6",
    "text-neutral-900 dark:text-neutral-100",
    onClick ? "cursor-pointer" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Comp
      onClick={onClick}
      className={combinedClassName}
      {...(onClick ? { role: "button", tabIndex: 0 } : {})}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(e);
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      {...rest}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg md:text-xl font-semibold leading-snug">{title}</h3>
          {subtitle && (
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{subtitle}</p>
          )}
        </div>
      </div>

      {children ? <div className="mt-4">{children}</div> : null}

      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-indigo-500/0 group-hover:ring-1 group-hover:ring-indigo-500/15 dark:group-hover:ring-indigo-400/15 transition-all duration-200 ease-soft" />
    </Comp>
  );
}
