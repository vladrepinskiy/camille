# Camille

A tools-enabled, local-first AI personal assistant that runs as a daemon with CLI and Telegram interfaces.

> See [AGENTS.md](AGENTS.md) for architectural decisions and coding conventions.

- **Daemon**: Long-running process that owns state, memory, tools, and permissions
- **CLI**: Connects via Unix socket (`~/.camille/camille.sock`)
- **Telegram**: Bot API with secure pairing (CLI-generated codes)
- **Storage**: SQLite at `~/.camille/camille.db`

## Development

```bash
# Install dependencies
npm install

# Run CLI in development
npm run cli -- --help
npm run cli -- start -f    # foreground mode

# Type check
npm run build:check
```

## Build

```bash
# Production build (uses tsup)
npm run build

# Run production build
node dist/cli.js --help
```

## CLI Commands

```
camille start [-f]       # Start daemon (-f for foreground)
camille stop             # Stop daemon
camille status           # Check if running
camille chat             # Interactive REPL
camille pair             # Generate Telegram pairing code
camille allow <path>     # Whitelist directory for read access
camille disallow <path>  # Remove from whitelist
camille paths            # List whitelisted paths
camille reset [--all]    # Wipe database and memory (--all includes config)
```

## Configuration

Create `~/.camille/config.toml`:

```toml
[telegram]
botToken = "your-bot-token"

[llm]
provider = "ollama"  # or "openai"
model = "llama3.2"
apiKey = "sk-..."    # for openai
baseUrl = "http://localhost:11434"  # optional
```

Falls back to defaults if missing or invalid.

## Permissions

Camille runs in a strict sandbox:

- **Write/Delete**: Only inside `~/.camille/`
- **Read/Search**: Only `~/.camille/` + whitelisted paths
- **Whitelist**: CLI-only (`camille allow`), cannot be modified via chat

## Dependencies

| Package          | Purpose                     |
| ---------------- | --------------------------- |
| `better-sqlite3` | Synchronous SQLite driver   |
| `kysely`         | Type-safe SQL query builder |
| `commander`      | CLI argument parsing        |
| `grammy`         | Telegram bot framework      |
| `zod`            | Schema validation           |
| `smol-toml`      | TOML config parsing         |

Dev: `tsx` (TypeScript runner), `tsup` (bundler), `typescript`

## Project Structure

```
src/
├── index.ts           # Daemon entry
├── cli.ts             # CLI commands
├── core/
│   ├── agent.ts       # Message processing
│   ├── runtime.ts     # Daemon lifecycle
│   ├── config.ts      # Config loading
│   └── permissions.ts # Filesystem sandbox
├── db/
│   ├── index.ts       # Kysely queries
│   ├── database.ts    # Type definitions
│   └── schema.sql     # DDL
├── clients/
│   ├── ipc/           # Unix socket server/client
│   └── telegram/      # Bot implementation
├── tools/             # Agent tools (search, read)
├── logging/           # Logger (stdout + SQLite)
└── utils/             # Paths, crypto helpers
```
