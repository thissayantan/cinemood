import { useEffect, useState } from "react";
import type { User } from "@cinemood/shared";
import { api } from "./api";

export type UserState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "ok"; user: User };

export function useUser(): UserState {
  const [state, setState] = useState<UserState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api<User>("/api/me");
      if (cancelled) return;
      if (res.ok) setState({ status: "ok", user: res.data });
      else setState({ status: "anon" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export async function logout(): Promise<void> {
  await api("/auth/logout", { method: "POST" });
  window.location.href = "/";
}

/** Sign the user out everywhere — invalidates every previously-issued
 *  session token (current device, other browsers, other devices,
 *  stolen cookies) by bumping the user's revocation watermark on the
 *  server. After this returns, every device with a saved cookie will
 *  be bounced to the landing page on the next request. */
export async function logoutEverywhere(): Promise<void> {
  await api("/auth/logout-everywhere", { method: "POST" });
  window.location.href = "/";
}
