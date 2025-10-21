import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
}

export default function StatCard({
  title,
  subtitle,
  children,
  className,
  ...rest
}: StatCardProps) {
  return (
    <div
      className={cn(
        // surface
        "relative rounded-2xl bg-white dark:bg-neutral-900/80",
        // border and ring
        "ring-1 ring-black/5 dark:ring-white/10",
        // depth + motion
        "shadow-[0_1px_1px_rgb(0_0_0/0.04),0_8px_24px_rgb(0_0_0/0.06)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04)]",
        "transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md",
        "hover:ring-black/10 dark:hover:ring-white/15",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 dark:focus-visible:ring-offset-neutral-950",
        // layout
        "p-4 sm:p-5 md:p-6 flex flex-col",
        className,
      )}
      {...rest}
    >
      <div className="mb-3">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">{title}</h3>
        {subtitle ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
