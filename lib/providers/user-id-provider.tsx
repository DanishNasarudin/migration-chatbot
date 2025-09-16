// UserIdCookieProvider.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type SameSite = "Lax" | "Strict" | "None";

export type CookieOptions = {
  path?: string;
  domain?: string;
  sameSite?: SameSite;
  secure?: boolean; // defaults true on https:
  maxAgeSeconds?: number; // e.g. 31536000 for ~1 year
};

export type UserIdCookieContext = {
  userId: string | null;
  isReady: boolean;
  refresh: () => void;
  clear: () => void;
};

const Ctx = createContext<UserIdCookieContext | undefined>(undefined);

export type UserIdCookieProviderProps = {
  cookieName?: string; // cookie key
  initialId?: string | null; // pass from server for hydration
  options?: CookieOptions;
  generate?: () => string; // optional (e.g. nanoid)
  children: React.ReactNode;
};

const defaultGenerate = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const c of cookies) {
    const [k, ...rest] = c.split("=");
    if (k === decodeURIComponent(name))
      return decodeURIComponent(rest.join("="));
  }
  return null;
}

function setCookie(name: string, value: string, opts: CookieOptions = {}) {
  if (typeof document === "undefined") return;
  const {
    path = "/",
    domain,
    sameSite = "Lax",
    secure = typeof location !== "undefined"
      ? location.protocol === "https:"
      : true,
    maxAgeSeconds = 315360000, // ~10 years
  } = opts;

  let str = `${encodeURIComponent(name)}=${encodeURIComponent(
    value
  )}; Path=${path}; Max-Age=${maxAgeSeconds}; SameSite=${sameSite}`;
  if (domain) str += `; Domain=${domain}`;
  if (secure) str += `; Secure`;
  document.cookie = str;
}

function deleteCookie(name: string, opts: CookieOptions = {}) {
  setCookie(name, "", { ...opts, maxAgeSeconds: 0 });
}

export function UserIdCookieProvider({
  cookieName = "app_uid",
  initialId = null,
  options,
  generate = defaultGenerate,
  children,
}: UserIdCookieProviderProps) {
  const [userId, setUserId] = useState<string | null>(initialId);
  const [isReady, setIsReady] = useState(false);
  const lastSeen = useRef<string | null>(initialId);

  const ensureOnce = useCallback((): string | null => {
    if (typeof window === "undefined") return null; // SSR guard
    try {
      const existing = getCookie(cookieName);
      if (existing && existing.length > 0) return existing;
      const next = generate();
      setCookie(cookieName, next, options);
      return next;
    } catch {
      return null;
    }
  }, [cookieName, options, generate]);

  useEffect(() => {
    const id = ensureOnce();
    setUserId(id);
    lastSeen.current = id;
    setIsReady(true);

    // No native cookie change event — do a lightweight resync on visibility changes.
    const sync = () => {
      const current = getCookie(cookieName);
      if (current !== lastSeen.current) {
        lastSeen.current = current;
        setUserId(current);
      }
    };
    document.addEventListener("visibilitychange", sync);
    const int = window.setInterval(sync, 5000);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.clearInterval(int);
    };
  }, [ensureOnce, cookieName]);

  const refresh = useCallback(() => {
    try {
      const next = generate();
      setCookie(cookieName, next, options);
      lastSeen.current = next;
      setUserId(next);
    } catch {}
  }, [cookieName, options, generate]);

  const clear = useCallback(() => {
    try {
      deleteCookie(cookieName, options);
      lastSeen.current = null;
      setUserId(null);
    } catch {}
  }, [cookieName, options]);

  const value = useMemo<UserIdCookieContext>(
    () => ({ userId, isReady, refresh, clear }),
    [userId, isReady, refresh, clear]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUserIdCookie(): UserIdCookieContext {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error(
      "useUserIdCookie must be used within <UserIdCookieProvider>"
    );
  return ctx;
}
