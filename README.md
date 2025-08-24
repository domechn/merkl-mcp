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

- opportunities.search
- opportunities.get
- opportunities.campaigns
- opportunities.count
- opportunities.binsApr
- opportunities.binsTvl
- opportunities.aggregate
- opportunities.aggregateMax
- opportunities.aggregateMin

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

### One-line npx startup

After publishing as `merkl-mcp-server` to npm (or using `npm link`), you can start the server with:

```bash
npx merkl-mcp
```

If `dist/server.js` is missing, the CLI will build automatically on first run.

## Publish to npm

Set the name in package.json (already set up for you via bin aliases) and publish:

```bash
npm login   # if not already
npm publish --access public
```

Then users can run:

```bash
npx merkl-mcp-server
# or the short alias
npx merkl-mcp
```
