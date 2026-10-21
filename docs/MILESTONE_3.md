# Milestone 3: Daily Driver UX

## Scope and preflight

Preflight confirmed branch `feat/daily-driver-ux`, a clean working tree, and the merged Milestone 2 commit `9131917`. Read `PROJECT_SPEC.md`, `AGENTS.md`, and the first two milestone records before editing. This milestone implements the daily UX described in specification sections 10–16, 23–24, and 30 while preserving the deterministic scheduling rules documented in Milestone 2.

The implementation is ready for code review. The requested native walkthrough is **partially complete**: the user stopped Computer Use with the physical Escape key before the final Tasks/responsive/restart checks. No desktop automation was attempted after that interruption. Do not treat this milestone as fully validated until the remaining manual checks below are completed.

## Daily workflow and visual changes

- **Hoy** is the daily command center: Santiago greeting/date, today's planned work, capacity remaining from now, completions today, active or next task, proposed block time, next fixed event, deadline attention, and a chronological remaining-day agenda. Planificar/Replanificar stays prominent. A running timer suppresses other starts. Completar finishes a task; agenda actions explicitly say Completar tarea. Otra tarea temporarily skips a suggestion in the current view without changing estimates, status, or stored blocks; replanning resets those skipped suggestions.
- **Spanish planning summaries** use hours/minutes and explain deadline overload, unscheduled work, missing estimates, ineligibility, and preserved conflicts. Capacity warnings take precedence. Additional explanations sit behind native details controls. Warnings still describe the last explicit plan, and changed workspace revisions still show the stale-plan notice. Remaining-day capacity subtracts the union of events and plan reservations from enabled availability after the current instant; it does not count elapsed capacity or double-count overlapping events.
- **Semana** uses a custom timeline with seven day columns, sticky day headers, a time axis, project labels/colors, deadline counts, the current day/time, and vertical scrolling. Fixed events use dashed outlines, proposed work uses project-tinted fills, and reserved work has a stronger border and a diamond marker. Concurrent fixed events use separate lanes; touching intervals, including timestamps with seconds/milliseconds, stay adjacent. Geometry uses elapsed time from the actual Santiago day start, retaining repeated hours and real durations. DST days have a change-of-hour label, and an extended repeated hour is marked separately. Very short blocks retain their position and offer the full label through accessible names/tooltips and the day agenda.
- **Mes** shows deadline labels, planned workload bars, risk/overload indicators, and notable fixed events rather than an all-task list. Day selection brings its action agenda into view; a return action restores the overview. Narrow windows keep the load/risk indicators and use the selected agenda for details.
- **+ Tarea** is available from the shell. A native modal dialog supplies keyboard focus containment and Escape dismissal. A title is sufficient; project, estimate, deadline, and priority remain immediately available. Description, lifecycle status, timed deadlines, splitting, and minimum block size are in Más opciones. The same form remains available for editing.
- **Proyectos** have persistent colors, a compact responsive grid, editable identities/status, open-task counts with correct Spanish plurals, and links to filtered tasks. Unassigned tasks/events have a neutral fallback. Color appears consistently in tasks, Today, agendas, the weekly schedule, and monthly deadlines.
- **Disponibilidad** contrasts active windows with dimmed, explicitly Desactivada windows. Disabled configured hours still contribute zero capacity. Multiple windows, overlap rejection, atomic replacement, and Santiago semantics are unchanged.
- **Eventos** have a shell-adjacent + Evento action, ordinary minute-based defaults at the next half hour, optional place/notes, chronological upcoming events, and an include-past toggle. Editing retains timestamp precision. Invalid local DST inputs and nonpositive ranges receive Spanish feedback. Existing delete confirmation and persistence semantics remain intact.
- **Ajustes** persists system/dark/light appearance, displays the fixed Santiago timezone, and exposes the already-supported 1–90-day planning horizon. Changes apply on the next explicit plan; the default remains 42 days. Appearance alone does not mark a plan stale.
- Navigation and primary user-facing labels are Spanish; internal enums, APIs, schema names, planning reasons, and diagnostic warning payloads remain English. Unavailable Inbox/Settings placeholders were replaced by useful task capture and real settings. Saving status no longer shifts the page layout.

No calendar dependency, LLM, natural-language parsing, external integration, account, synchronization, notification, voice, or background agent was added.

## Schema, contract, and compatibility

Migration **004_daily_driver.sql** is additive. Migrations 001–003 are unchanged; their ledger and compatibility checks remain authoritative. Existing projects and task/calendar/timer data are preserved. Existing projects receive the fallback color `#6d8c80`.

| Change                      | Validation and behavior                                                                                                                                                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projects.color`            | Required six-digit hex color with a database constraint. Rust validates and normalizes lowercase; older-shaped project inputs can omit it and receive the fallback. New project defaults prefer unused palette colors.                                                                             |
| `preferences`               | Singleton row with `theme` (`system`, `dark`, `light`) and integer `horizon_days` (1–90), defaulting to system/42. Both application validation and SQLite constraints enforce the allowed values.                                                                                                  |
| Preference revision trigger | Changing the horizon increments the workspace revision so older schedule writes are rejected by existing revision checks. Appearance-only changes do not invalidate a plan.                                                                                                                        |
| Typed IPC                   | `ProjectInput`/`Project` include `color`; workspace snapshots include `preferences`; `save_preferences` returns the authoritative snapshot. TypeScript and Rust are aligned. The frontend application service reads the saved horizon from a fresh snapshot before calling the existing scheduler. |

SQLite remains the only persistent store. No browser-storage fallback was introduced. Scheduling allocation, priority scoring, task eligibility, time tracking, protected-block preservation, deadline semantics, and transactional schedule validation are unchanged. Past proposed work never becomes recorded work or completion automatically.

The opt-in debug seed now provides a fictitious daily workspace with three projects, six tasks, two fixed events, enabled weekday windows, and disabled weekends. It runs only when task/project/event/availability tables are empty and `CHARLIE_SEED=1`; it never runs in release builds. Planning remains an explicit UI action. QA used the ignored `.validation/milestone3.sqlite3` database, leaving the personal database untouched.

## Automated validation

Passed after the implementation/refinements:

- `pnpm typecheck` and `pnpm build`.
- `pnpm lint`.
- `pnpm format:check`. Existing README/Milestone 2 formatting was normalized; the README was updated for this milestone.
- `pnpm test`: **60 tests** (all 51 existing tests preserved, eight presentation tests and one application-service test added). Existing date-format assertions now expect Spanish. Added coverage includes duration rounding across hours, workload summaries, deadline dates, remaining capacity, disabled windows, overlapping commitments, concurrent calendar lanes, adjacent second-precision intervals, multi-day clipping, repeated Santiago hours, and the persisted planning horizon/fresh revision contract.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`: **27 integration tests** (all 25 existing tests preserved; two added for Milestone 2 upgrades, color/preference validation, revision semantics, SQL constraints, and reopen persistence).
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`.
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`.
- `cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`.
- `git diff --check` at the review handoff.

The sandbox initially blocked dependency/toolchain path access; the checks succeeded using the approved command execution path. A Spanish locale date-format assertion initially failed and was corrected to an explicit named-month format. The native walkthrough exposed false calendar overlap for adjacent fractional-minute blocks; the geometry was corrected and a regression test added. No unresolved automated failures remain.

## Native desktop verification and remaining checks

`pnpm tauri dev` compiled and launched the native executable with Vite and applied migrations 001–004 to the isolated opt-in QA database. Through the Computer Use skill, at the default 1080 × 720 desktop size:

- Inspected Hoy's greeting, summary, next commitment, deadlines, and remaining agenda with realistic fictitious persisted data.
- Planned a workload exceeding usable capacity and verified human-readable Spanish overload/unscheduled-work summaries.
- Created a title-only task through + Tarea and verified the saved task and stale-plan indication.
- Started and completed the suggested task. The completion count changed to one, the next recommendation advanced, and a closed TimeEntry recorded approximately 52 seconds.
- Inspected the visual Week schedule, selected Wednesday's day agenda, reserved its first future work block, and replanned. The block remained reserved, retaining its exact ID and UTC boundaries (`2026-10-14T12:00:00.000Z`–`2026-10-14T13:07:46.464Z`), also confirmed by a read-only QA database query.
- Inspected Month's workload bars, deadline labels, event labels, and risk markers.
- Inspected active weekday and explicitly disabled weekend availability, saved the existing configuration, and verified its saved feedback.
- Created a one-hour local event, then edited its title while retaining the times.
- Inspected project colors/counts and created a fourth fictitious project with a persisted color.
- Inspected Settings and saved the light appearance. The native UI visibly changed from system-dark to light and showed saved feedback. Horizon persistence/use is covered by the automated tests; changing it through native controls was not exercised.

The user then stopped Computer Use with the physical Escape key. Remaining native checks:

1. Walk through the final Tasks filters/editor and the new project-to-tasks link.
2. Inspect the final compact project grid, short-block styling, and the common smaller/minimum window layouts after the last refinements.
3. Replan after the newly created/edited event and availability save, inspect event avoidance and retained locks, then close and reopen the desktop app against the same QA database. Verify tasks, project colors, events, enabled flags, warnings, blocks/locks, timers, and theme remain available.

Automated reopen tests confirm disk persistence for the new fields and all existing calendar/timer data, but they do **not** replace this requested native restart walkthrough. No commit, push, merge, or next-milestone work was performed.
