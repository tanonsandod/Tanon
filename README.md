# TANON

Electrical Panel Schematic & Production — **Windows desktop client** (Tauri 2 + React) with **central PostgreSQL server**.

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────┐
│  Tanon.exe (Windows)    │  SQL    │  PostgreSQL Server   │
│  • React UI (local)     │ ──────▶ │  (shared projects,   │
│  • Rust logic (local)   │         │   catalog, sheets)   │
│  • SLD canvas (local)   │         └──────────────────────┘
└─────────────────────────┘
```

- **No web app server** — UI and logic run on each Windows client
- **Only the database is centralised** — multiple clients share one PostgreSQL instance
- **Not a browser SaaS** — installed `.exe` using WebView2 for rendering only

## Quick Start

### 1. Start central database (server)

```bash
docker compose up -d
```

Default credentials (change in production):

| Setting  | Value          |
|----------|----------------|
| Host     | `localhost` or server IP |
| Port     | `5432`         |
| Database | `tanon`        |
| User     | `tanon`        |
| Password | `tanon_secret` |

On **Windows Server**, install [PostgreSQL](https://www.postgresql.org/download/windows/) and create the same database/user, or run Docker Desktop.

### 2. Configure client

Copy `config/tanon.example.toml` to:

```
%APPDATA%\Tanon\config.toml
```

Or set environment variable:

```bat
set TANON_DATABASE_URL=postgresql://tanon:tanon_secret@192.168.1.10:5432/tanon
```

You can also use **ตั้งค่า DB** in the app UI.

### 3. Run desktop app

```bash
npm install
npm run tauri dev      # Windows + WebView2 + PostgreSQL reachable
npm run build          # frontend only
```

### Windows prerequisites

Install [Tauri prerequisites](https://tauri.app/start/prerequisites/) (WebView2, Visual Studio Build Tools).

## Project Structure

```
docker-compose.yml       # PostgreSQL server template
config/tanon.example.toml
schema/                  # SQL schema reference (legacy SQLite docs)
src-tauri/
  migrations/postgres/   # PostgreSQL migrations (auto-run on connect)
  src/db/                # connection, config, migrations
  src/commands/          # Tauri IPC commands
src/
  components/            # React UI (+ DatabaseSettings)
```

## Data Model

```
Project → Drawing → Panel Design → Sheets / Devices / Busbar
                                  → Panel Instances (mass production)
```

See `schema/RELATIONS.md` for full ER diagram.

## Tauri Commands

| Command | Description |
|---------|-------------|
| `list_projects` | List all projects |
| `get_project_tree` | Full hierarchy for a project |
| `get_drawing_bom` | Busbar BOM for a drawing |
| `reset_demo_data` | Reset & re-seed E22-111 demo |
| `get_database_config` | Read client DB settings |
| `get_database_status` | Connection health + project count |
| `test_database_connection` | Test settings without saving |
| `save_database_config` | Save settings (restart app to apply) |
| `save_sld_content` / `complete_sld` | SLD workflow |
| `list_catalog_items` | ABB / Schneider catalog |

## Tests

Requires PostgreSQL running:

```bash
docker compose up -d
cd src-tauri
TANON_DATABASE_URL=postgresql://tanon:tanon_secret@localhost:5432/tanon cargo test
```
