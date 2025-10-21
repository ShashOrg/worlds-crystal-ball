"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import QuestionCardBase from "./QuestionCardBase";

type DataAttributes = Partial<Record<`data-${string}`, string | number | boolean>>;

type Props = React.PropsWithChildren<{
    title: string;
    subtitle?: string;
    href?: string;
    onSelectKey?: string;
    className?: string;
    dataAttributes?: DataAttributes;
}>;

export default function QuestionCardClient({
    title,
    subtitle,
    href,
    onSelectKey,
    className,
    dataAttributes,
    children,
}: Props) {
    const router = useRouter();

    const handle = React.useCallback(() => {
        if (href) {
            router.push(href);
            return;
        }
        if (onSelectKey) {
            // Hook into your client-side action dispatcher here.
            // e.g. actions.open(onSelectKey);
        }
    }, [href, onSelectKey, router]);

    const interactive = Boolean(href ?? onSelectKey);

    return (
        <div
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? handle : undefined}
            onKeyDown={
                interactive
                    ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handle();
                          }
                      }
                    : undefined
            }
            className={[
                "group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400",
                "transition-all duration-200 ease-soft",
                interactive ? "cursor-pointer hover:-translate-y-[2px] hover:shadow-cardHover active:translate-y-0" : "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <QuestionCardBase
                title={title}
                subtitle={subtitle}
                className={className}
                dataAttributes={dataAttributes}
            >
                {children}
            </QuestionCardBase>
        </div>
    );
}
