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
                // base
                "relative rounded-2xl bg-white/90 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800",
                // depth + motion
                "shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md hover:ring-2 hover:ring-indigo-400/30",
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
