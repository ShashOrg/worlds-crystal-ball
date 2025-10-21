export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter((value): value is string => Boolean(value)).join(" ");
}
