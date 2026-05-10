import type { WatchStatus } from "@cinemood/shared";

type StatusFilter = WatchStatus | "all";

interface Props {
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  type: "movie" | "series" | "all";
  onType: (t: "movie" | "series" | "all") => void;
  genres: string[];
  selectedGenre: string | null;
  onGenre: (g: string | null) => void;
  years: string[];
  selectedYear: string | null;
  onYear: (y: string | null) => void;
  total: number;
}

export function FilterChips(p: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill active={p.status === "all"} onClick={() => p.onStatus("all")}>
          All <Counter>{p.total}</Counter>
        </Pill>
        <Pill
          active={p.status === "pending"}
          onClick={() => p.onStatus("pending")}
        >
          To watch
        </Pill>
        <Pill
          active={p.status === "watched"}
          onClick={() => p.onStatus("watched")}
        >
          Watched
        </Pill>
        <Divider />
        <Pill active={p.type === "all"} onClick={() => p.onType("all")}>
          Any
        </Pill>
        <Pill active={p.type === "movie"} onClick={() => p.onType("movie")}>
          Movies
        </Pill>
        <Pill active={p.type === "series"} onClick={() => p.onType("series")}>
          Series
        </Pill>
      </div>

      {(p.genres.length > 0 || p.years.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {p.genres.map((g) => (
            <Pill
              key={`g-${g}`}
              active={p.selectedGenre === g}
              onClick={() => p.onGenre(p.selectedGenre === g ? null : g)}
            >
              {g}
            </Pill>
          ))}
          {p.years.length > 0 && p.genres.length > 0 && <Divider />}
          {p.years.map((y) => (
            <Pill
              key={`y-${y}`}
              active={p.selectedYear === y}
              onClick={() => p.onYear(p.selectedYear === y ? null : y)}
            >
              {y}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-white/40 bg-white/15 text-white"
          : "border-white/10 bg-white/5 text-white/65 hover:border-white/20 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Counter({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
      {children}
    </span>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />;
}
