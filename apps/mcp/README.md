# @cinemood/mcp

Cinemood MCP server — manage your movie and series watchlist from Claude Desktop, OpenAI, or any MCP-compatible client.

## Prerequisites

1. A Cinemood account at [cinemood.sayantan.cloud](https://cinemood.sayantan.cloud)
2. A personal access token from [cinemood.sayantan.cloud/settings/tokens](https://cinemood.sayantan.cloud/settings/tokens)
3. Node.js 18+ (for `npx`)

## Claude Desktop

Add to `claude_desktop_config.json` (usually `~/.config/claude/claude_desktop_config.json` on Linux or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "cinemood": {
      "command": "npx",
      "args": ["-y", "@cinemood/mcp"],
      "env": {
        "CINEMOOD_TOKEN": "cmt_…your_token_here…"
      }
    }
  }
}
```

Restart Claude Desktop. You should see the Cinemood tools appear.

## OpenAI / other MCP clients

```bash
CINEMOOD_TOKEN=cmt_… npx @cinemood/mcp
```

The server starts on stdio and follows the MCP protocol.

## Available tools

| Tool | Description |
|------|-------------|
| `list_watchlist` | List/filter your watchlist (status, type, genre, sort) |
| `search_watchlist` | Natural-language search ("dark thrillers with strong female leads") |
| `add_to_watchlist` | Search TMDB and add a title; or add by TMDB id directly |
| `set_status` | Mark a title as `pending`, `watching`, or `watched` |
| `remove_from_watchlist` | Remove a title permanently |
| `recommend` | AI mood-based recommendation from your watchlist |
| `compare_titles` | Side-by-side AI comparison of 2–6 titles |
| `decide_questions` | Generate preference Q&A to decide what to watch |
| `decide_pick` | Pick the winner from Q&A answers |

## Example Claude Desktop session

> "What thrillers are in my watchlist?"

> "I'm in the mood for something funny and under 2 hours — what should I watch?"

> "Compare Parasite, Everything Everywhere All at Once, and The Favourite for me."

> "Help me decide between my pending films using a few questions."

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CINEMOOD_TOKEN` | ✅ | — | Personal access token from /settings/tokens |
| `CINEMOOD_BASE_URL` | No | `https://cinemood.sayantan.cloud` | Override for local development |
