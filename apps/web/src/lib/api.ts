import type { ApiResponse, SeasonDetail } from "@cinemood/shared";

export async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  return res.json() as Promise<ApiResponse<T>>;
}

export async function fetchSeason(
  titleId: number,
  season: number,
): Promise<SeasonDetail | null> {
  const res = await api<SeasonDetail>(
    `/api/title/series/${titleId}/season/${season}`,
  );
  return res.ok ? res.data : null;
}

export interface PersonDetail {
  id: number;
  name: string;
  biography: string | null;
  profile_path: string | null;
  birthday: string | null;
  known_for_department: string | null;
  place_of_birth: string | null;
  credits: {
    id: number;
    type: "movie" | "series";
    title: string;
    poster_path: string | null;
    character: string | null;
    release_date: string | null;
    vote_average: number | null;
    popularity: number | null;
  }[];
}

export async function fetchPerson(id: number): Promise<PersonDetail | null> {
  const res = await api<PersonDetail>(`/api/person/${id}`);
  return res.ok ? res.data : null;
}
