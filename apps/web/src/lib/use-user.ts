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
