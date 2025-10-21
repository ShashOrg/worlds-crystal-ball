export function QuestionCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-white/80 shadow-sm ring-1 ring-black/[0.06] p-6 dark:bg-neutral-900/70 dark:border-neutral-800 animate-pulse">
      <div className="h-5 w-2/3 rounded-md bg-neutral-200 dark:bg-neutral-700" />
      <div className="mt-3 h-4 w-1/2 rounded-md bg-neutral-200 dark:bg-neutral-700" />
      <div className="mt-6 h-9 w-24 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
    </div>
  );
}
