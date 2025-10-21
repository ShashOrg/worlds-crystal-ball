import * as React from "react";

type DataAttributes = Partial<Record<`data-${string}`, string | number | boolean>>;

type Props = React.PropsWithChildren<{
    title: string;
    subtitle?: string;
    className?: string;
    dataAttributes?: DataAttributes;
}>;

export default function QuestionCardBase({
    title,
    subtitle,
    className = "",
    dataAttributes,
    children,
}: Props) {
    const dataAttributeProps: Record<string, string | number | boolean> = {};
    if (dataAttributes) {
        for (const [key, value] of Object.entries(dataAttributes)) {
            if (value !== undefined) {
                dataAttributeProps[key] = value;
            }
        }
    }

    return (
        <div
            {...dataAttributeProps}
            className={[
                "group relative rounded-2xl",
                "bg-neutral-100/90 dark:bg-neutral-800/80",
                "border border-neutral-200/80 dark:border-neutral-700/70",
                "shadow-card transition-all duration-200 ease-soft",
                "hover:shadow-cardHover group-hover:shadow-cardHover",
                "p-4 sm:p-5 md:p-6",
                "text-neutral-900 dark:text-neutral-100",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold leading-snug sm:text-lg md:text-xl">{title}</h3>
                    {subtitle ? (
                        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{subtitle}</p>
                    ) : null}
                </div>
            </div>

            {children ? <div className="mt-4">{children}</div> : null}

            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-indigo-500/0 transition-all duration-200 ease-soft group-hover:ring-1 group-hover:ring-indigo-500/15 dark:group-hover:ring-indigo-400/15" />
        </div>
    );
}
