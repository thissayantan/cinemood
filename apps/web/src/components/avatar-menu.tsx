import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { User } from "@cinemood/shared";
import { logout } from "@/lib/use-user";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

const MENU_ITEM_CLASS =
  "block px-3 py-2 text-[13px] transition hover:bg-[var(--paper-3)]";

function initials(user: User): string {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function AvatarMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={`Account · ${user.name ?? user.email}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--paper-2)] py-1 pl-1 pr-3 text-sm text-[var(--ink)] transition hover:bg-[var(--paper-3)]"
      >
        <Avatar className="h-7 w-7">
          {user.picture ? (
            <AvatarImage src={user.picture} alt={user.name ?? user.email} />
          ) : null}
          <AvatarFallback>{initials(user)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-[10rem] truncate sm:inline">
          {user.name ?? user.email}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--paper-2)] text-[var(--ink)] shadow-[var(--shadow-card)]"
          role="menu"
        >
          <div className="border-b border-[var(--rule)] px-3 py-2.5">
            <div className="font-label text-[10px] text-[var(--paper-faint)]">
              Signed in as
            </div>
            <div className="mt-0.5 truncate text-[13px] text-[var(--ink)]">
              {user.email}
            </div>
          </div>
          <Link
            to="/import"
            className={MENU_ITEM_CLASS}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Import a list
          </Link>
          <Link
            to="/settings/account"
            className={MENU_ITEM_CLASS}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Account
          </Link>
          <Link
            to="/settings/search"
            className={MENU_ITEM_CLASS}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Search settings
          </Link>
          <button
            type="button"
            onClick={logout}
            className="block w-full border-t border-[var(--rule)] px-3 py-2 text-left text-[13px] transition hover:bg-[var(--paper-3)]"
            role="menuitem"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
