import { useState } from "react";
import { Link } from "react-router-dom";
import type { User } from "@cinemood/shared";
import { logout } from "@/lib/use-user";
import { ThemeToggle } from "./theme-toggle";

export function AvatarMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const initial = (user.name ?? user.email).slice(0, 1).toUpperCase();

  return (
    <div className="relative flex items-center gap-2">
      <ThemeToggle />
      <button
        type="button"
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-black/10 bg-black/5 py-1 pl-1 pr-3 text-sm backdrop-blur-xl transition hover:bg-black/10 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
      >
        {user.picture ? (
          <img
            src={user.picture}
            alt=""
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-black/10 text-xs font-medium dark:bg-white/10">
            {initial}
          </span>
        )}
        <span className="max-w-[10rem] truncate text-black/80 dark:text-white/80">
          {user.name ?? user.email}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/15 bg-[#15151c]/90 backdrop-blur-xl shadow-2xl"
          role="menu"
        >
          <div className="border-b border-white/10 px-3 py-2 text-xs text-white/50">
            {user.email}
          </div>
          <Link
            to="/import"
            className="block px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Import
          </Link>
          <Link
            to="/settings/search"
            className="block px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Search settings
          </Link>
          <button
            type="button"
            onClick={logout}
            className="block w-full border-t border-white/10 px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10"
            role="menuitem"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
