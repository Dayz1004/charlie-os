# Repository Guidelines

## Project Structure & Module Organization

The verified Milestone 0 foundation is extended by Milestones 1–3: local tasks/projects, SQLite persistence, task time tracking, deterministic scheduling, local events, availability, and Today/Week/Month views. `docs/PRODUCT_SPEC.md` remains the product source of truth; `docs/MILESTONE_1.md`, `docs/MILESTONE_2.md`, and `docs/MILESTONE_3.md` record implementation decisions.

- `src/domain/`: pure models, clock/date rules, priority and planning. No React or persistence imports.
- `src/application/`: use cases and repository interfaces.
- `src/adapters/`: typed Tauri command bridge.
- `src/features/`, `src/app/`, `src/components/`: views, composition, and shared presentation.
- `src-tauri/src/`: Rust commands, application services, domain validation, SQLite repositories.
- `src-tauri/migrations/`: numbered immutable SQL migrations.
- `src-tauri/tests/`: persistence integration tests using temporary databases.
- `public/`: static assets; TypeScript tests are colocated `*.test.ts` files.

Extend functional vertical slices before increasing product scope.

## Build, Test, and Development Commands

Use pnpm and the existing lockfiles:

- `pnpm install --frozen-lockfile`: install frontend dependencies.
- `pnpm tauri dev`: launch the desktop development application.
- `pnpm typecheck`: check frontend and Vite configuration types.
- `pnpm build`: type-check and build the frontend.
- `pnpm tauri build`: package the desktop application.
- `pnpm lint`: run ESLint.
- `pnpm format:check`: check Prettier formatting; `pnpm format` applies it.
- `pnpm test`: run Vitest unit tests.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`: run Rust integration tests.
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`: check Rust compilation.
- `cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: check Rust linting.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: check Rust formatting.

## Coding Style & Naming Conventions

Use two-space indentation for TypeScript/TSX and four spaces for Rust. Use PascalCase for React components and types, camelCase for TypeScript functions/variables and IPC JSON, and snake_case for Rust functions/modules. Use ESLint, Prettier, and rustfmt. Keep dependencies minimal. Keep both sides of the typed IPC contract aligned.

## Testing Guidelines

Use Vitest and Rust's test framework. Prioritize deterministic planning, priority/risk scoring, deadlines, timezone handling, and duration calculations. Inject a clock or explicit instant into time-sensitive logic. Test blocked-task exclusion, tasks without deadlines, and the single-active-task constraint, including separate SQLite connections. Add migration/persistence integration tests using temporary databases and fictitious fixtures. Verify desktop creation and restart persistence when changing persistence workflows.

Scheduling tests must cover fixed events, availability boundaries, splitting, minimum blocks, no overlap, overload, preserved blocks, and Santiago DST gaps/repeated hours. Replanning replaces only unlocked future work. Use workspace revisions to reject stale schedule writes. Never infer completed work from past proposed blocks or silently alter task estimates/deadlines.

## Commit & Pull Request Guidelines

Use concise imperative commits, e.g. `feat: persist and plan local tasks`. Keep changes focused. PRs should explain behavior, link relevant specification sections, report validation, and include screenshots for UI changes. Describe schema migrations and compatibility. Do not commit, push, or merge unless the user authorizes it.

## Architecture & Configuration

SQLite is the authoritative local source of truth; frontend state is a transient projection. Planning stays deterministic and independent of React/persistence. Distinguish absolute UTC timestamps, local dates, and date-only deadlines; display/interpret local times in `America/Santiago`. Numbered migrations are immutable after release. Never commit secrets, `.env` files, personal databases, or tokens. `CHARLIE_DB_PATH` and `CHARLIE_SEED` are debug-only options; seed data must be fictitious and opt-in. Keep v0.1 focused on local tasks, projects, events, and Today; defer OAuth, external integrations, and natural-language AI capture to later milestones.
