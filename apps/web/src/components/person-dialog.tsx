import { useEffect, useState } from "react";
import { Dialog, AnimatedDialogContent } from "./dialog";
import { fetchPerson, type PersonDetail } from "@/lib/api";
import { posterUrl } from "@/lib/tmdb";

interface Props {
  personId: number | null;
  onOpenChange: (open: boolean) => void;
}

export function PersonDialog({ personId, onOpenChange }: Props) {
  return (
    <Dialog open={personId !== null} onOpenChange={onOpenChange}>
      <AnimatedDialogContent
        open={personId !== null}
        side="center"
        title="Person detail"
      >
        {personId !== null ? (
          <PersonBody personId={personId} />
        ) : null}
      </AnimatedDialogContent>
    </Dialog>
  );
}

function PersonBody({ personId }: { personId: number }) {
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPerson(null);
    fetchPerson(personId).then((data) => {
      if (!cancelled) {
        setPerson(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [personId]);

  if (loading) {
    return (
      <div className="flex h-[320px] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--rule)] border-t-[var(--accent)]" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="flex h-[240px] items-center justify-center">
        <p className="text-[14px] text-[var(--paper-dim)]">
          Could not load person details.
        </p>
      </div>
    );
  }

  const photo = person.profile_path
    ? `https://image.tmdb.org/t/p/h632${person.profile_path}`
    : null;

  const birthYear = person.birthday ? person.birthday.slice(0, 4) : null;
  const country = person.place_of_birth
    ? person.place_of_birth.split(",").pop()?.trim()
    : null;

  const BIO_THRESHOLD = 480;
  const bioLong = (person.biography?.length ?? 0) > BIO_THRESHOLD;
  const bioText =
    bioLong && !expanded
      ? person.biography!.slice(0, BIO_THRESHOLD).trimEnd() + "…"
      : person.biography;

  // Top 12 credits sorted by popularity, deduplicated by id
  const credits = person.credits
    .filter((c) => c.poster_path)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 12);

  return (
    <div>
      {/* Hero photo */}
      <div className="relative h-[240px] overflow-hidden bg-[var(--paper-3)] md:h-[320px]">
        {photo ? (
          <img
            src={photo}
            alt={person.name}
            className="h-full w-full object-cover object-top"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 40%, color-mix(in oklab, var(--paper-2) 80%, transparent) 90%, var(--paper-2) 100%)",
          }}
        />
        <div className="absolute bottom-0 left-0 px-6 pb-5">
          <h2
            className="font-display-md text-[28px] leading-tight text-[var(--ink)] md:text-[36px]"
            style={{ fontVariationSettings: '"opsz" 48, "wght" 800, "SOFT" 20' }}
          >
            {person.name}
          </h2>
          {(person.known_for_department || birthYear || country) && (
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-dim)]">
              {[person.known_for_department, birthYear, country]
                .filter(Boolean)
                .join("  ·  ")}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pb-8 pt-5">
        {/* Biography */}
        {person.biography ? (
          <div className="mb-6">
            <div className="mb-2 font-label text-[10px] uppercase tracking-widest text-[var(--paper-faint)]">
              Biography
            </div>
            <p className="max-w-[68ch] text-[14px] leading-[1.6] text-[var(--ink)]">
              {bioText}
            </p>
            {bioLong && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="mt-2 font-label text-[10px] uppercase tracking-wider text-[var(--accent)] hover:opacity-75"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        ) : null}

        {/* Filmography */}
        {credits.length > 0 && (
          <div>
            <div className="mb-3 font-label text-[10px] uppercase tracking-widest text-[var(--paper-faint)]">
              Known for
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {credits.map((credit) => {
                const poster = posterUrl(credit.poster_path, "w185");
                const year = credit.release_date?.slice(0, 4);
                return (
                  <div key={`${credit.id}-${credit.type}`} className="w-[88px] shrink-0">
                    <div
                      className="aspect-[2/3] overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--paper-3)]"
                    >
                      {poster && (
                        <img
                          src={poster}
                          alt={credit.title}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="mt-1.5 text-[11px] leading-tight text-[var(--ink)] line-clamp-2">
                      {credit.title}
                    </div>
                    {(year || credit.character) && (
                      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--paper-faint)] line-clamp-1">
                        {credit.character ?? year}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
