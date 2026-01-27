# Agents Guide

> After any large change, check if this file or README.md needs updating.

## What is Camille

A daemon-style AI personal assistant. Single long-running process owns all state. CLI and Telegram are just I/O adapters connecting via IPC.

## Key Decisions

### Architecture

- **Daemon + clients model**, not "CLI app" or "web server"
- IPC via Unix domain socket (`~/.camille/camille.sock`), newline-delimited JSON
- All data in `~/.camille/` (db, socket, pid, config, logs)

### Database

- **SQLite** with `better-sqlite3` (synchronous driver, simple)
- **Repository pattern**: one file per entity in `src/db/repositories/`
- Types in `src/db/db.types.ts`, schema in `src/db/schema.sql`
- No ORM — just typed wrapper functions around raw SQL

### Security

- **Filesystem sandbox**: write only to `~/.camille/`, read requires whitelist
- **Whitelist is CLI-only**: `camille allow <path>` — cannot be modified via chat
- `allowed_paths.added_by` is typed as `"cli"` literal — enforced at compile time
- **Telegram pairing**: short-lived codes (5 min), SHA256 hashed, generated via CLI

### Config

- **Hardcoded defaults in source** — immune to agent corruption
- Config file (`~/.camille/config.toml`) validated with Zod
- Invalid/missing config falls back to defaults, logs warning, doesn't crash

### Code Style

- **Path aliases**: use `@/` imports (e.g., `import { paths } from "@/utils/paths.util"`)
- **No `.js` extensions** in imports — tsx and tsup handle resolution
- **Module resolution**: `Bundler` mode in tsconfig
- **Build**: `tsup` for production (bundles, resolves aliases), `tsx` for dev
- **Newline before return**: add blank line before `return` unless it's the only statement in the block
- **Newline after early return**: add blank line after early `return` / guard clauses
- **File naming**: type files use `*.types.ts`, utility files use `*.util.ts`

### Tools

- Tools must call `permissions.assertRead()` / `assertWrite()` before any FS operation
- Tool interface uses Zod for input validation
