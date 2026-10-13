# CHARLIE OS

A local-first personal workspace for tasks, projects, and time. `PROJECT_SPEC.md` defines the product; `AGENTS.md` contains contributor guidelines.

Milestone 2 adds local Events, weekly Availability, deterministic work scheduling, and Calendar views to the task/time vertical slice. Today, Tasks, basic Projects, and Calendar are functional. Inbox and Settings remain unavailable. No AI, OAuth, or external integrations are connected.

In Calendar, save enabled availability windows and fixed events, then select **Plan / Replan**. The scheduler proposes work across the next 42 Santiago days, preserves past/ongoing and locked future blocks, and reports insufficient capacity. Tasks keep their estimates and deadlines; proposed work does not count as recorded time. Use Week or Month to inspect the plan and lock future blocks. Replanning is an explicit action.

## Development

Use Node.js 22.18+ (or a supported newer LTS), pnpm 11.19.0, stable Rust with the `x86_64-pc-windows-msvc` host, Microsoft C++ Build Tools, a Windows SDK, and WebView2.

```powershell
pnpm install --frozen-lockfile
pnpm tauri dev
```

Tauri starts Vite at `http://localhost:1420` and opens the native window. Task operations require the desktop backend; the browser alone has no alternate task store. Port 1420 must be available. Close the window and stop the terminal with Ctrl+C when finished.

## Validation

```powershell
pnpm build
pnpm lint
pnpm format:check
pnpm test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --locked --manifest-path src-tauri/Cargo.toml
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
pnpm tauri dev
```

`pnpm typecheck` can be run separately. `pnpm tauri build` packages the app. `pnpm format` formats frontend files and documentation; use `cargo fmt` for Rust. Vitest covers deterministic planning, risk, and Santiago dates; Rust integration tests use temporary SQLite databases for migrations, persistence, state transitions, and timer invariants.

## Data and time

The database is `charlie.sqlite3` under Tauri's application local-data directory (`%LOCALAPPDATA%\dev.charlie.os` on Windows). SQLite is the authoritative store. There is no localStorage fallback or automatic seed in production. Numbered migrations run transactionally on startup and never reset existing data. Task work totals are derived from closed time entries.

Date-only deadlines keep their `YYYY-MM-DD` value and expire at the start of the next Santiago day. Timed deadlines and lifecycle timestamps are absolute UTC RFC3339 values. The UI displays and interprets times in `America/Santiago`, including daylight-saving transitions. Ambiguous/nonexistent local time inputs are rejected.

An open timer continues across app restarts, including time spent with the app closed. Stop records the elapsed milliseconds and returns the task to `todo`; Complete records elapsed time and marks it `done`. Stop or complete the current task before starting another. A backward clock change produces an error when closing a timer rather than recording negative work.

## Isolated development data

Debug builds support an optional database override and seed:

```powershell
$env:CHARLIE_DB_PATH = 'C:\dev\charlie-os\.validation\demo.sqlite3'
$env:CHARLIE_SEED = '1'
pnpm tauri dev
```

The seed adds one fictitious task only when the task table is empty. Both environment options are ignored in release builds. Omit `CHARLIE_SEED` for a blank database. Never commit personal databases, credentials, `.env` files, or validation artifacts.

## Boundaries

- `src/domain/`: models, clock/date calculations, pure priority and planning functions; no React, Tauri, or database imports.
- `src/application/`: repository interface and frontend use cases.
- `src/adapters/`: typed Tauri command/DTO bridge. Keep its contract aligned with Rust `commands.rs` and `domain.rs`.
- `src/app/`: shell, composition, navigation, and transient state projected from backend snapshots.
- `src/features/`: Today, Tasks, Projects, and Calendar views.
- `src/styles/`: semantic tokens and Tailwind styles; system light/dark mode supported.
- `src-tauri/src/domain.rs`: DTOs, validation, injectable backend clock, and elapsed-time rules.
- `src-tauri/src/application.rs`: use cases, identity creation, clock injection.
- `src-tauri/src/repository.rs`, `schedule_repository.rs`: SQLite queries and atomic persistence transitions, including calendar data and schedule validation.
- `src-tauri/src/database.rs`, `src-tauri/migrations/`: connection setup and immutable versioned migrations.
- `src-tauri/tests/`: persistence and migration integration tests.

[Milestone 1 decisions and validation](docs/MILESTONE_1.md) describe the schema, heuristic, limits, and desktop smoke test.

[Milestone 2 decisions and validation](docs/MILESTONE_2.md) specify the scheduling algorithm, overload detection, migration, DST semantics, and completed desktop restart scenario.

## Added dependencies

`@tauri-apps/api` supplies the IPC bridge. `@js-temporal/polyfill` provides timezone-aware calendar-date and local-time conversion, including Chilean DST. `vitest` runs frontend domain tests. Rust uses bundled `rusqlite` for offline SQLite, `serde`/`serde_json` for typed DTOs and saved warnings, `chrono`/`chrono-tz` for timestamps and Santiago availability validation, and `uuid` for stable identities. `tempfile` supports integration tests. No calendar library or new frontend dependency was added in Milestone 2. React state remains sufficient.
