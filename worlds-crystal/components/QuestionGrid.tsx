import * as React from "react";

import QuestionCard from "@/components/ui/QuestionCard";

export type QuestionGridItem = {
  id: string;
  title: string;
  subtitle?: string;
  content?: React.ReactNode;
  cardClassName?: string;
  cardProps?: React.HTMLAttributes<HTMLElement>;
};

export default function QuestionGrid({
  items,
  className = "",
}: {
  items: QuestionGridItem[];
  className?: string;
}) {
  return (
    <div
      className={[
        "grid gap-4 sm:gap-5 md:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((item) => {
        const { className: extraClassName, ...remainingCardProps } = item.cardProps ?? {};
        const mergedClassName = [item.cardClassName, extraClassName].filter(Boolean).join(" ");

        return (
          <QuestionCard
            key={item.id}
            title={item.title}
            subtitle={item.subtitle}
            className={mergedClassName}
            {...remainingCardProps}
          >
            {item.content}
          </QuestionCard>
        );
      })}
    </div>
  );
}
