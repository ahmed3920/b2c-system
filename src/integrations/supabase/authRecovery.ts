import { supabase } from "./client";

/**
 * Removes any Supabase auth tokens cached in localStorage.
 * Used to recover from a poisoned/invalid refresh token state that
 * otherwise causes a refresh-loop and eventual 429 from /auth/v1/token.
 */
export function clearStaleAuth() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore (private mode, etc.)
  }
}

let bootstrapped = false;

/**
 * One-shot bootstrap that:
 * 1. Tries to restore the session.
 * 2. If the refresh token is invalid / not found, clears local storage
 *    so the next page load doesn't re-trigger the failing refresh.
 * 3. Listens for future TOKEN_REFRESHED failures via SIGNED_OUT and
 *    cleans up local storage so the user lands on /auth cleanly.
 */
export async function bootstrapAuth() {
  if (bootstrapped) return;
  bootstrapped = true;

  try {
    const { error } = await supabase.auth.getSession();
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (
        msg.includes("refresh token") ||
        msg.includes("invalid_refresh_token") ||
        msg.includes("not found")
      ) {
        clearStaleAuth();
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          /* noop */
        }
      }
    }
  } catch {
    clearStaleAuth();
  }

  supabase.auth.onAuthStateChange((event) => {
    // When the SDK gives up on a bad refresh token it emits SIGNED_OUT.
    // Make sure no stale token survives in storage.
    if (event === "SIGNED_OUT") {
      clearStaleAuth();
    }
  });
}
