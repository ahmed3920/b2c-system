import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "default_email_cc_list_v1";

/** Default CC recipients automatically added to every action-plan email. */
export const DEFAULT_CC_LIST: string[] = [
  "seif.mohamed@ischooltech.com",
  "asmaa.nasef@ischooltech.com",
  "amr.mohamed@ischooltech.com",
  "mohamed.alaa@ischooltech.com",
];

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_CC_LIST];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
  } catch {
    // ignore
  }
  return [...DEFAULT_CC_LIST];
}

function save(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function useDefaultEmailCc() {
  const [list, setList] = useState<string[]>(() => load());

  useEffect(() => {
    save(list);
  }, [list]);

  const addEmail = useCallback((email: string) => {
    const e = email.trim().toLowerCase();
    if (!e || !/^\S+@\S+\.\S+$/.test(e)) return false;
    setList((prev) => (prev.includes(e) ? prev : [...prev, e]));
    return true;
  }, []);

  const removeEmail = useCallback((email: string) => {
    setList((prev) => prev.filter((x) => x.toLowerCase() !== email.toLowerCase()));
  }, []);

  const reset = useCallback(() => setList([...DEFAULT_CC_LIST]), []);

  return { list, addEmail, removeEmail, reset };
}

/** Merge default CC list with any user-typed extras (deduped, lowercased). */
export function mergeCcList(defaults: string[], extra: string): string {
  const fromExtra = extra
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of [...defaults, ...fromExtra]) {
    const k = e.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(e);
    }
  }
  return out.join(", ");
}
