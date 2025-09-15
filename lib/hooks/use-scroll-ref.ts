"use client";
import { useRef } from "react";

export function useScrollRef<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  const scrollToTop = (behavior: ScrollBehavior = "smooth") =>
    ref.current?.scrollTo({ top: 0, behavior });

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  };

  return { ref, scrollToTop, scrollToBottom };
}
