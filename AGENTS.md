# Repository Guidelines

## Project Structure & Module Organization

This project is at the specification stage. `PROJECT_SPEC.md` defines CHARLIE OS; code, tests, assets, and build configuration are not scaffolded.

Use this layout when scaffolding the specified Tauri/React/TypeScript/SQLite stack:

- `src/`: frontend features, domain models, application services, and integration adapters; keep these concerns separate.
- `src-tauri/`: Rust commands, SQLite repositories, and versioned migrations.
- `public/`: static assets.
- Colocated `*.test.ts` files for TypeScript unit tests; dedicated integration tests for persistence flows.

Implement functional vertical slices, starting with task creation, persistence, recommendation, time tracking, and completion.

## Build, Test, and Development Commands

No commands are runnable yet. Prefer pnpm when scaffolding, and configure these entry points:

- `pnpm install`: install frontend dependencies.
- `pnpm tauri dev`: launch the desktop development application.
- `pnpm build`: type-check and build the frontend.
- `pnpm tauri build`: package the desktop application.
- `pnpm test`: run TypeScript unit tests.
- `cargo test --manifest-path src-tauri/Cargo.toml`: run Rust tests.

Update this guide when scripts exist.

## Coding Style & Naming Conventions

Adopt two-space indentation for TypeScript/TSX and four spaces for Rust. Use PascalCase for React components and types, camelCase for TypeScript functions and variables, and snake_case for Rust functions and modules. Configure ESLint and Prettier for the frontend; use rustfmt for Rust. Keep dependencies minimal and domain logic independent of UI and provider APIs.

## Testing Guidelines

No test framework or coverage threshold is configured. Prefer Vitest for TypeScript and Rust's built-in test framework. Prioritize deterministic planning, priority/risk scoring, deadlines, timezone handling, and duration calculations. Test blocked-task exclusion, tasks without deadlines, and the single-active-task constraint. Add integration tests for migrations and persistence across restarts; use temporary databases and fictitious fixtures.

## Commit & Pull Request Guidelines

No Git repository or commit history exists here. Adopt concise imperative commits, for example `feat: persist inbox tasks` or `fix: handle date-only deadlines`. Keep changes focused. PRs should explain behavior, link relevant issues or specification sections, report validation results, and include screenshots for UI changes. Describe schema migrations and data compatibility.

## Architecture & Configuration

Keep SQLite as the local source of truth and planning deterministic. Distinguish absolute timestamps, local dates, and date-only deadlines; display times using `America/Santiago`. Never commit secrets, `.env` files, personal databases, or tokens. Use versioned migrations and development-only seeds. Keep v0.1 focused on local tasks, projects, events, and Today; defer OAuth and external integrations.
