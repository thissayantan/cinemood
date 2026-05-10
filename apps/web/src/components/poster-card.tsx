import { motion } from "framer-motion";
import { posterUrl } from "@/lib/tmdb";

interface Props {
  title: string;
  year: string | null;
  posterPath: string | null;
  badge?: string;
  rating?: number | null;
  onClick?: () => void;
  disabled?: boolean;
  added?: boolean;
}

export function PosterCard({
  title,
  year,
  posterPath,
  badge,
  rating,
  onClick,
  disabled,
  added,
}: Props) {
  const src = posterUrl(posterPath, "w342");

  return (
    <motion.button
      type="button"
      whileHover={disabled ? {} : { scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
      className={`group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left backdrop-blur-xl transition ${
        disabled ? "cursor-default opacity-60" : "hover:border-white/25 hover:bg-white/10"
      }`}
    >
      <div className="relative aspect-[2/3] w-full bg-black/30">
        {src ? (
          <img
            src={src}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-white/40">
            No poster
          </div>
        )}
        {badge && (
          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/85 backdrop-blur">
            {badge}
          </span>
        )}
        {added && (
          <span className="absolute right-2 top-2 rounded-full bg-emerald-400/85 px-2 py-0.5 text-[10px] font-semibold text-black">
            Saved
          </span>
        )}
        {typeof rating === "number" && rating > 0 && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur">
            ★ {rating.toFixed(1)}
          </span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <div className="line-clamp-2 text-sm font-medium text-white/90">{title}</div>
        {year && <div className="mt-0.5 text-xs text-white/45">{year}</div>}
      </div>
    </motion.button>
  );
}
