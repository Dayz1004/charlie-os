# Milestone 1: the task vertical slice

## Schema and compatibility

SQLite lives in the Tauri app local-data directory. Foreign keys are enabled, WAL is used, and busy operations wait up to five seconds. Startup applies numbered SQL migrations and their ledger in one immediate transaction. Unknown/newer or changed migration history is rejected. Existing task data is preserved on upgrade; there is no reset-on-launch behavior.

| Table               | Important data and constraints                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema_migrations` | Ordered version and applied SQL; records immutable migration history.                                                                                            |
| `projects`          | UUID, name, description, status, UTC creation/update/archive timestamps.                                                                                         |
| `tasks`             | UUID, title, description, nullable project/priority/estimate, status, tagged deadline kind/value, UTC lifecycle timestamps. Only one `in_progress` task.         |
| `time_entries`      | UUID, task FK, UTC start/end/creation timestamps, nullable nonnegative integer duration in milliseconds. A partial unique index permits one open entry globally. |
| `task_dependencies` | Task/prerequisite FK pair; no self-reference, duplicate pair, or application-created cycle.                                                                      |

Migration 001 creates projects, tasks, and timers. Migration 002 adds prerequisites. Dependencies have typed commands and planning/start enforcement; a dependency editor is deferred. Tasks are cancelled through the status editor rather than deleted, preserving time history. Completed tasks can be reopened by editing status. Work totals are computed from closed entries, preventing drift between stored task totals and timer history.

## Planning and risk

The pure TypeScript engine reads its injected clock once. Open inbox/todo tasks qualify only when their project is active (or absent) and all prerequisites are done. Blocked, done, cancelled, and active tasks are excluded. While a timer is open, Today shows that task and suppresses starting another recommendation.

Remaining work is `max(1, estimate - recorded work - active session work)`. A missing estimate assumes 30 minutes solely for scoring, disclosed in the recommendation.

| Risk     | Condition, evaluated in order                                          |
| -------- | ---------------------------------------------------------------------- |
| Critical | Deadline passed, or time until deadline is at most the remaining work. |
| High     | At most twice the remaining work time, or due within 24 hours.         |
| Medium   | At most four times the remaining work time, or due within 72 hours.    |
| Low      | Other deadlines, or no deadline.                                       |

Scores are 300/200/100/0 for critical/high/medium/low plus 20/10/0 for manual high/normal/low (unspecified: 0). Sort by descending score, then earliest deadline, oldest creation timestamp, and UUID for stable ties. Tasks without deadlines remain candidates. Completion replaces the frontend snapshot and recalculates the next task. Replan reloads SQLite and recomputes. Risk alerts also include blocked tasks so their approaching deadlines remain visible.

This is an elapsed-time heuristic, not an availability forecast. It does not model sleep, events, working hours, free blocks, or automatic scheduling. It does not claim a task is feasible just because risk is low.

## Time semantics and boundaries

Date-only deadlines remain calendar dates, expiring at the start of the following day in `America/Santiago`. Timed deadlines become absolute UTC timestamps. Temporal handles Chilean DST; ambiguous or nonexistent local deadline inputs are rejected. UI editing preserves millisecond precision. Backend validation rejects invalid dates and timestamps lacking an offset.

Rust owns authoritative validation, UUIDs, timestamps, migrations, and transactional state changes. Its service injects a clock; repositories contain SQL. The frontend application service depends on a repository interface; the Tauri adapter contains command names and typed DTOs. React holds snapshots and uses pure domain functions. No task data is persisted in browser storage.

Start inserts a timer and marks the task active atomically. Stop closes that timer and returns the task to todo. Complete closes an active timer and marks the task done in the same transaction. Closing an already completed task is idempotent. Both UI serialization and database constraints enforce one active task; SQLite's immediate transactions protect multiple app processes. An open timer survives app closure and includes offline elapsed time. A backward clock movement rejects timer closure without partial writes; the display clamps to zero until the clock is corrected.

## Validation

Automated checks cover TypeScript planning/risk and Santiago date/time behavior; Rust integration checks cover schema upgrades, idempotent/failed/changed migrations, persistence across reopen, validation, foreign keys, task transitions, prerequisites/cycles, and timer exclusivity/duration/recovery. Fixtures are fictitious and databases temporary.

The frontend build/typecheck, ESLint, 29 Vitest tests, 15 Rust integration tests, Cargo check, and Clippy passed. Final formatting checks are included in the review handoff. `pnpm tauri dev` launched the native executable, served Vite, and applied both migrations to an isolated QA database under ignored `.validation/`.

Native UI verification was interrupted by the user's physical Escape key during Computer Use. The manual create-task → close-app → reopen-app persistence check and full native action workflow were **not completed**. Automated integration tests verify disk persistence and open-timer recovery across reopening the database, but do not replace the requested manual verification. No further UI automation was attempted after the interruption.
