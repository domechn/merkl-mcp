# Merkl MCP Server

An MCP server exposing Merkl Opportunities endpoints using `@modelcontextprotocol/sdk`.

## Setup

- Node.js 18+ recommended
- Install deps

```bash
npm install
```

Optionally set environment variables:

- `MERKL_BASE_URL` (default: <https://api.merkl.xyz>)
- `MERKL_API_KEY` (Bearer token if you have one; public endpoints work without it)

## Run (local)

- Dev server:

```bash
npm run dev
```

- Start once:

```bash
npm run build
npm start
```

- Smoke test (direct HTTP call, not MCP):

```bash
npm run smoke
```

## Tools exposed

- opportunities-search
- opportunities-get
- opportunities-campaigns
- opportunities-count
- opportunities-bins-apr
- opportunities-bins-tvl
- opportunities-aggregate
- opportunities-aggregate-max
- opportunities-aggregate-min

## Use with an MCP-compatible client

This server uses the stdio transport. Point your MCP client to run the command and read/write on stdio:

- Command:

```bash
npx merkl-mcp
```

- Or locally via repo:

```bash
npm start
```

Set env vars as needed (e.g. `MERKL_API_KEY`). The server will register tools listed above.

Note: Requires Node 18+. Enable debug logs by setting `MERKL_DEBUG=1`.

### One-line npx startup

After publishing as `merkl-mcp` to npm (or using `npm link`), you can start the server with:

```bash
npx merkl-mcp
```

If `dist/server.js` is missing, the CLI will build automatically on first run.

## Connect to Claude Desktop (macOS)

Claude Desktop supports MCP over stdio. Add this server to Claude's config and restart the app.

1. Create or edit config file

- Path: `~/Library/Application Support/Claude/claude_desktop_config.json`

1. Use the published package (one-line npx)

```json
{
  "mcpServers": {
    "merkl": {
      "command": "npx",
      "args": ["-y", "merkl-mcp"],
      "env": {
        "MERKL_API_KEY": "(Optional) YOUR_API_KEY_OR_REMOVE_IF_UNUSED"
      }
    }
  }
}
```

1. Or run from local repo

```json
{
  "mcpServers": {
    "merkl": {
      "command": "node",
      "args": ["dist/src/server.js"],
      "cwd": "./merkl-mcp",
      "env": {
        "MERKL_API_KEY": "(Optional) YOUR_API_KEY_OR_REMOVE_IF_UNUSED"
      }
    }
  }
}
```

1. Restart Claude Desktop

- Start a new chat; the tool named `merkl` should appear in the Tools list.

Troubleshooting

- Ensure Node.js 18+ is installed and available to Claude's environment.
- Remove `MERKL_API_KEY` if you don't have one; public endpoints work without it.
- Check Claude logs if tools don't appear; verify the config file path and JSON syntax.

## Publish to npm

Set the name in package.json (already set up for you via bin aliases) and publish:

```bash
npm login   # if not already
npm publish --access public
```

Then users can run:

```bash
npx merkl-mcp
# or the short alias
npx merkl-mcp
```
