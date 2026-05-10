export type TitleType = "movie" | "series";

export interface ImportCandidate {
  raw: string;
  title: string;
  year?: number;
  type?: TitleType;
}

// Tiny CSV parser handling double-quoted fields with embedded commas/newlines.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      // Handle CRLF.
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.length > 0)) rows.push(row);
  }
  return rows;
}

export function parseTextarea(text: string): ImportCandidate[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.+?)\s*\((\d{4})\)\s*$/);
      if (m) {
        return { raw: line, title: m[1]!.trim(), year: Number(m[2]) };
      }
      return { raw: line, title: line };
    });
}

const TYPE_HINT_MAP: Record<string, TitleType> = {
  "tv series": "series",
  "tv mini series": "series",
  "tv miniseries": "series",
  "tv special": "series",
  series: "series",
  show: "series",
  tv: "series",
  movie: "movie",
  film: "movie",
  feature: "movie",
};

function inferType(rawType: string | undefined): TitleType | undefined {
  if (!rawType) return undefined;
  const k = rawType.trim().toLowerCase();
  return TYPE_HINT_MAP[k];
}

export interface CsvParseResult {
  candidates: ImportCandidate[];
  detected: "letterboxd" | "imdb" | "trakt" | "generic";
  warning?: string;
}

export function parseCsvImport(text: string): CsvParseResult {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { candidates: [], detected: "generic", warning: "Empty file" };
  }
  const header = rows[0]!.map((h) => h.trim().toLowerCase());

  const titleIdx = header.findIndex(
    (h) => h === "name" || h === "title" || h === "letterboxd uri",
  );
  const yearIdx = header.findIndex(
    (h) => h === "year" || h === "release year" || h === "release_year",
  );
  const typeIdx = header.findIndex((h) => h === "title type" || h === "type");

  let detected: CsvParseResult["detected"] = "generic";
  if (header.includes("letterboxd uri")) detected = "letterboxd";
  else if (header.includes("title type") && header.includes("imdb rating"))
    detected = "imdb";
  else if (header.includes("rank") && header.includes("title"))
    detected = "trakt";

  const dataRows = titleIdx === -1 ? rows : rows.slice(1);
  const useFirstCol = titleIdx === -1;

  const candidates: ImportCandidate[] = [];
  for (const row of dataRows) {
    if (row.length === 0) continue;
    const titleRaw = useFirstCol ? row[0] : row[titleIdx];
    if (!titleRaw || !titleRaw.trim()) continue;
    const title = titleRaw.trim();
    const yearRaw = yearIdx >= 0 ? row[yearIdx] : undefined;
    const year = yearRaw ? Number(yearRaw.trim().slice(0, 4)) : undefined;
    const typeRaw = typeIdx >= 0 ? row[typeIdx] : undefined;
    candidates.push({
      raw: title + (year ? ` (${year})` : ""),
      title,
      year: Number.isFinite(year) && year! > 0 ? year : undefined,
      type: inferType(typeRaw),
    });
  }

  return { candidates, detected };
}

export function parseTakeoutJson(text: string): ImportCandidate[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }
  const out: ImportCandidate[] = [];
  const seen = new Set<string>();

  function visit(v: unknown) {
    if (!v) return;
    if (Array.isArray(v)) {
      for (const item of v) visit(item);
      return;
    }
    if (typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const title =
      pickString(o, ["title", "name", "movie_title", "show_title"]) ?? null;
    if (title) {
      if (seen.has(title)) return;
      seen.add(title);
      const yearRaw =
        pickString(o, ["year", "release_year", "releaseYear"]) ?? "";
      const year = yearRaw ? Number(yearRaw.toString().slice(0, 4)) : undefined;
      const typeRaw = pickString(o, ["type", "title_type"]);
      out.push({
        raw: title + (year ? ` (${year})` : ""),
        title,
        year: Number.isFinite(year) && year! > 0 ? year : undefined,
        type: inferType(typeRaw ?? undefined),
      });
    }
    // Recurse into nested fields.
    for (const value of Object.values(o)) {
      if (value && typeof value === "object") visit(value);
    }
  }

  visit(json);
  return out;
}

function pickString(
  obj: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}
