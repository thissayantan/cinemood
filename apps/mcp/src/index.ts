#!/usr/bin/env node
/**
 * Cinemood MCP server — stdio transport.
 *
 * Connects Claude Desktop (or any MCP client) to your Cinemood watchlist.
 * Authentication: set CINEMOOD_TOKEN to a personal access token from
 * cinemood.sayantan.cloud/settings/tokens.
 *
 * Tools:
 *   list_watchlist      — list/filter your watchlist
 *   search_watchlist    — NL semantic search
 *   add_to_watchlist    — search TMDB and add a title
 *   set_status          — mark pending / watching / watched
 *   remove_from_watchlist — remove a title
 *   recommend           — AI mood-based recommendation
 *   compare_titles      — side-by-side AI comparison
 *   decide_questions    — generate swipe Q&A questions
 *   decide_pick         — pick the winner given answers
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── Config ─────────────────────────────────────────────────────────────────

const BASE_URL = process.env.CINEMOOD_BASE_URL ?? "https://cinemood.sayantan.cloud";
const TOKEN = process.env.CINEMOOD_TOKEN;

if (!TOKEN) {
  console.error(
    "Error: CINEMOOD_TOKEN is not set.\n" +
      "Create a personal access token at https://cinemood.sayantan.cloud/settings/tokens\n" +
      "and set it as the CINEMOOD_TOKEN environment variable.",
  );
  process.exit(1);
}

// ── API client ──────────────────────────────────────────────────────────────

async function cineMoodFetch(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const json = (await res.json()) as { ok: boolean; data?: unknown; error?: { message: string } };
  if (!json.ok) {
    throw new Error(json.error?.message ?? `API error: ${res.status}`);
  }
  return json.data;
}

// ── Server setup ────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "cinemood",
  version: "0.1.0",
});

// ── Tool: list_watchlist ────────────────────────────────────────────────────

server.tool(
  "list_watchlist",
  "List titles in the watchlist. Supports filtering by status, type, genre, and sorting.",
  {
    status: z
      .enum(["pending", "watching", "watched"])
      .optional()
      .describe("Filter by watch status. Omit for all titles."),
    type: z
      .enum(["movie", "series"])
      .optional()
      .describe("Filter to movies or series only."),
    genre: z.string().optional().describe("Filter by genre name, e.g. 'Thriller'"),
    sort: z
      .enum(["added_desc", "added_asc", "title_asc", "year_desc", "rating_desc", "started_desc"])
      .optional()
      .describe("Sort order. Default: added_desc."),
    limit: z.number().int().min(1).max(100).optional().describe("Max results. Default: 50."),
  },
  async ({ status, type, genre, sort, limit }) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    if (genre) params.set("genre", genre);
    if (sort) params.set("sort", sort);
    if (limit) params.set("limit", String(limit));

    const data = await cineMoodFetch(`/api/watchlist?${params}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ── Tool: search_watchlist ─────────────────────────────────────────────────

server.tool(
  "search_watchlist",
  "Semantic / natural-language search across the watchlist. Understands mood, genre, cast, etc.",
  {
    query: z
      .string()
      .min(1)
      .describe("Natural-language query, e.g. 'dark thrillers with strong female leads'"),
  },
  async ({ query }) => {
    const data = await cineMoodFetch("/api/search", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ── Tool: add_to_watchlist ─────────────────────────────────────────────────

server.tool(
  "add_to_watchlist",
  "Search TMDB for a film or series and add it to the watchlist. " +
    "Returns the top TMDB matches if multiple are found; adds the best match automatically.",
  {
    title: z
      .string()
      .min(1)
      .describe("Film or series title to search for and add."),
    auto_add: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "If true (default), automatically add the top TMDB result. " +
          "If false, return the top 5 matches for the caller to choose from.",
      ),
    tmdb_id: z
      .number()
      .int()
      .optional()
      .describe(
        "Specific TMDB id to add directly (skip the search). " +
          "Requires tmdb_type to also be set.",
      ),
    tmdb_type: z
      .enum(["movie", "series"])
      .optional()
      .describe("Required when tmdb_id is set."),
  },
  async ({ title, auto_add, tmdb_id, tmdb_type }) => {
    // Direct add by TMDB id
    if (tmdb_id && tmdb_type) {
      const data = await cineMoodFetch("/api/watchlist", {
        method: "POST",
        body: JSON.stringify({ tmdb_id: tmdb_id, type: tmdb_type }),
      });
      return {
        content: [{ type: "text", text: `Added successfully.\n${JSON.stringify(data, null, 2)}` }],
      };
    }

    // Search TMDB
    const hits = (await cineMoodFetch(
      `/api/search/tmdb?q=${encodeURIComponent(title)}`,
    )) as Array<{ id: number; type: string; title: string; release_date: string | null }>;

    if (!hits || hits.length === 0) {
      return {
        content: [{ type: "text", text: `No TMDB results found for "${title}".` }],
      };
    }

    if (!auto_add) {
      return {
        content: [{ type: "text", text: JSON.stringify(hits.slice(0, 5), null, 2) }],
      };
    }

    const top = hits[0]!;
    const data = await cineMoodFetch("/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ tmdb_id: top.id, type: top.type }),
    });
    return {
      content: [
        {
          type: "text",
          text: `Added "${top.title}" (${top.release_date?.slice(0, 4) ?? "?"}) to watchlist.\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    };
  },
);

// ── Tool: set_status ───────────────────────────────────────────────────────

server.tool(
  "set_status",
  "Update the watch status of a title already in the watchlist.",
  {
    title_id: z.number().int().positive().describe("The title's numeric id from list_watchlist."),
    status: z
      .enum(["pending", "watching", "watched"])
      .describe("New status: 'pending' (want to watch), 'watching' (in progress), 'watched' (done)."),
  },
  async ({ title_id, status }) => {
    const data = await cineMoodFetch(`/api/watchlist/${title_id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return {
      content: [{ type: "text", text: `Status updated to '${status}'.\n${JSON.stringify(data, null, 2)}` }],
    };
  },
);

// ── Tool: remove_from_watchlist ────────────────────────────────────────────

server.tool(
  "remove_from_watchlist",
  "Remove a title from the watchlist permanently.",
  {
    title_id: z.number().int().positive().describe("The title's numeric id from list_watchlist."),
  },
  async ({ title_id }) => {
    await cineMoodFetch(`/api/watchlist/${title_id}`, { method: "DELETE" });
    return {
      content: [{ type: "text", text: `Title ${title_id} removed from watchlist.` }],
    };
  },
);

// ── Tool: recommend ────────────────────────────────────────────────────────

server.tool(
  "recommend",
  "AI-powered mood-based recommendation. Given a mood description, ranks the best watchlist titles for right now.",
  {
    mood: z
      .string()
      .min(1)
      .max(500)
      .describe(
        "Describe the mood or what you're in the mood for, " +
          "e.g. 'something light and funny' or 'a slow-burn thriller'.",
      ),
    status: z
      .enum(["pending", "watching", "watched"])
      .optional()
      .describe("Restrict candidates to titles with this status. Omit for all."),
    limit: z.number().int().min(1).max(10).optional().default(5).describe("Max recommendations."),
  },
  async ({ mood, status, limit }) => {
    const data = await cineMoodFetch("/api/recommend", {
      method: "POST",
      body: JSON.stringify({ mood, ...(status ? { status } : {}), limit }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ── Tool: compare_titles ───────────────────────────────────────────────────

server.tool(
  "compare_titles",
  "Side-by-side AI comparison of 2–6 titles: deterministic metadata (year, runtime, genres, providers, ratings) + AI-generated feel columns (mood, pacing, tone, critical consensus).",
  {
    title_ids: z
      .array(z.number().int().positive())
      .min(2)
      .max(6)
      .describe("Array of title ids to compare (from list_watchlist)."),
  },
  async ({ title_ids }) => {
    const data = await cineMoodFetch("/api/compare", {
      method: "POST",
      body: JSON.stringify({ title_ids }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ── Tool: decide_questions ─────────────────────────────────────────────────

server.tool(
  "decide_questions",
  "Generate preference-revealing Q&A questions to help decide what to watch. " +
    "Pass the returned candidate_ids and answers to decide_pick.",
  {
    title_ids: z
      .array(z.number().int().positive())
      .max(100)
      .optional()
      .describe("Candidate title ids. Omit to use the whole watchlist."),
    status: z
      .enum(["pending", "watching", "watched"])
      .optional()
      .describe("Filter candidates by status when not providing title_ids."),
    count: z
      .number()
      .int()
      .min(3)
      .max(8)
      .optional()
      .default(5)
      .describe("Number of questions to generate. Default 5."),
  },
  async ({ title_ids, status, count }) => {
    const data = await cineMoodFetch("/api/decide/questions", {
      method: "POST",
      body: JSON.stringify({
        ...(title_ids ? { title_ids } : {}),
        ...(status ? { status } : {}),
        count,
      }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ── Tool: decide_pick ──────────────────────────────────────────────────────

server.tool(
  "decide_pick",
  "Given the candidate title ids and answered questions from decide_questions, " +
    "pick the best title to watch tonight. Returns winner + reason + runners-up.",
  {
    title_ids: z
      .array(z.number().int().positive())
      .min(1)
      .describe("Candidate title ids (from decide_questions response)."),
    answers: z
      .array(
        z.object({
          question_id: z.string(),
          option_id: z.string(),
        }),
      )
      .min(1)
      .describe("Answered questions from decide_questions."),
    mood: z
      .string()
      .max(500)
      .optional()
      .describe("Optional mood description to supplement the answers."),
  },
  async ({ title_ids, answers, mood }) => {
    const data = await cineMoodFetch("/api/decide/pick", {
      method: "POST",
      body: JSON.stringify({ title_ids, answers, ...(mood ? { mood } : {}) }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ── Start ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
