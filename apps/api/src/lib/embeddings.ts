import type { Env } from "../env";

export const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";
export const EMBEDDING_DIM = 768;

interface CfEmbeddingResponse {
  shape?: number[];
  data: number[][];
}

export async function embedText(env: Env, text: string): Promise<number[]> {
  const result = (await env.AI.run(EMBEDDING_MODEL as never, {
    text: [text],
  } as never)) as unknown as CfEmbeddingResponse;
  const vec = result.data?.[0];
  if (!vec || vec.length !== EMBEDDING_DIM) {
    throw new Error(`bad_embedding: len=${vec?.length ?? 0}`);
  }
  return vec;
}

export async function embedTexts(
  env: Env,
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const result = (await env.AI.run(EMBEDDING_MODEL as never, {
    text: texts,
  } as never)) as unknown as CfEmbeddingResponse;
  if (!result.data || result.data.length !== texts.length) {
    throw new Error(`bad_embedding_batch: ${result.data?.length ?? 0}/${texts.length}`);
  }
  return result.data;
}

export function buildIndexText(t: {
  title: string;
  original_title: string | null;
  overview: string | null;
  genres: string[];
  keywords: string[];
  cast: { name: string }[];
}): string {
  const cast = t.cast.slice(0, 10).map((c) => c.name).join(", ");
  const parts = [
    t.title,
    t.original_title && t.original_title !== t.title ? t.original_title : null,
    t.overview ?? "",
    t.genres.length ? `Genres: ${t.genres.join(", ")}` : "",
    t.keywords.length ? `Keywords: ${t.keywords.join(", ")}` : "",
    cast ? `Cast: ${cast}` : "",
  ].filter(Boolean);
  return parts.join("\n");
}
