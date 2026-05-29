import { type ClassValue, clsx } from "clsx";
import { format, isSameDay } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDisplayDate(value: Date | string, output = "EEE, MMM d") {
  return format(new Date(value), output);
}

export function isToday(value: Date | string) {
  return isSameDay(new Date(value), new Date());
}

export function safePercentage(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function groupBy<T, K extends string | number>(
  items: T[],
  selector: (item: T) => K
) {
  return items.reduce<Record<K, T[]>>((accumulator, item) => {
    const key = selector(item);
    accumulator[key] ??= [];
    accumulator[key].push(item);
    return accumulator;
  }, {} as Record<K, T[]>);
}
