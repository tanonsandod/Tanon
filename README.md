# TANON

Electrical Panel Schematic & Production — Native desktop app (Tauri 2 + React + SQLite)

## Features (current)

- Project → Drawing → Panel Design → Sheets hierarchy
- Demo data: **Project E22** → **Drawing E22-111**
  - **MDB1** (qty 1) — sheets ELE A01–A20
  - **DB** (qty 10 set) — sheets ELE B01–B03
- Busbar config (DIN EN 61439 / DIN 43671)
- BOM busbar mass calculation
- Project tree explorer UI

## Quick Start

```bash
npm install
npm run tauri dev      # desktop (requires OS prerequisites)
npm run build          # frontend only
```

### Windows prerequisites

Install [Tauri prerequisites](https://tauri.app/start/prerequisites/) (WebView2, Visual Studio Build Tools).

## Project Structure

```
schema/                  # SQL schema & seed (reference)
src-tauri/
  migrations/            # embedded SQL migrations
  src/db/                # SQLite init & seed
  src/commands/          # Tauri IPC commands
src/
  types/                 # TypeScript types
  components/            # React UI
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
