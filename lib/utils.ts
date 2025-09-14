import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async <T>(
  url: string,
  cache: boolean = true
): Promise<T> => {
  const caching = cache ? undefined : ({ cache: "no-store" } as RequestInit);
  const r = await fetch(url, caching);
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as T;
};
