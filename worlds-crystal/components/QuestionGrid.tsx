import * as React from "react";
import Link from "next/link";

import QuestionCardBase from "@/components/ui/QuestionCardBase";
import QuestionCardClient from "@/components/ui/QuestionCardClient";

type DataAttributes = Partial<Record<`data-${string}`, string | number | boolean>>;

type Item = {
    id: string;
    title: string;
    subtitle?: string;
    href?: string;
    clientActionKey?: string;
    content?: React.ReactNode;
    cardClassName?: string;
    dataAttributes?: DataAttributes;
};

type Props = {
    items: Item[];
    className?: string;
};

const interactiveWrapperClasses = [
    "group block rounded-2xl",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400",
    "transition-all duration-200 ease-soft",
    "hover:-translate-y-[2px] hover:shadow-cardHover active:translate-y-0",
].join(" ");

export default function QuestionGrid({ items, className = "" }: Props) {
    return (
        <div
            className={["grid grid-cols-1 gap-4 sm:gap-5 md:gap-6 sm:grid-cols-2 xl:grid-cols-3", className]
                .filter(Boolean)
                .join(" ")}
        >
            {items.map((item) => {
                const dataAttributes = item.dataAttributes ?? undefined;

                if (item.href && !item.clientActionKey) {
                    return (
                        <Link key={item.id} href={item.href} className={interactiveWrapperClasses}>
                            <QuestionCardBase
                                title={item.title}
                                subtitle={item.subtitle}
                                className={item.cardClassName}
                                dataAttributes={dataAttributes}
                            >
                                {item.content}
                            </QuestionCardBase>
                        </Link>
                    );
                }

                if (item.clientActionKey) {
                    return (
                        <QuestionCardClient
                            key={item.id}
                            title={item.title}
                            subtitle={item.subtitle}
                            onSelectKey={item.clientActionKey}
                            className={item.cardClassName}
                            dataAttributes={dataAttributes}
                        >
                            {item.content}
                        </QuestionCardClient>
                    );
                }

                return (
                    <QuestionCardBase
                        key={item.id}
                        title={item.title}
                        subtitle={item.subtitle}
                        className={item.cardClassName}
                        dataAttributes={dataAttributes}
                    >
                        {item.content}
                    </QuestionCardBase>
                );
            })}
        </div>
    );
}
