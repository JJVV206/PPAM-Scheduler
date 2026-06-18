import { type ClassValue, clsx } from "clsx";
import {
  addDays,
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  startOfWeek
} from "date-fns";
import { es } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDisplayDate(value: Date | string, output = "EEE, MMM d") {
  return format(new Date(value), output, { locale: es });
}

export function formatDateRange(
  startDate: Date | string,
  endDate: Date | string
) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isSameMonth(start, end) && isSameYear(start, end)) {
    return `Del ${format(start, "d", { locale: es })} al ${format(
      end,
      "d 'de' MMMM 'de' yyyy",
      { locale: es }
    )}`;
  }

  if (isSameYear(start, end)) {
    return `Del ${format(start, "d 'de' MMMM", {
      locale: es
    })} al ${format(end, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
  }

  return `Del ${format(start, "d 'de' MMMM 'de' yyyy", {
    locale: es
  })} al ${format(end, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
}

export function formatWeekRange(value: Date | string) {
  const start = startOfWeek(new Date(value), { weekStartsOn: 1 });

  return formatDateRange(start, addDays(start, 6));
}

export function formatCount(
  count: number,
  singular: string,
  plural = `${singular}s`
) {
  return `${count} ${count === 1 ? singular : plural}`;
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
  return items.reduce<Record<K, T[]>>(
    (accumulator, item) => {
      const key = selector(item);
      accumulator[key] ??= [];
      accumulator[key].push(item);
      return accumulator;
    },
    {} as Record<K, T[]>
  );
}
