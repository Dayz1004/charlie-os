# Milestone 2: Scheduling Engine + Calendar

## Schema and compatibility

Migration 003 extends the existing SQLite database without resetting it or editing migrations 001/002. Migration history remains transactional, ordered, and immutable. Existing Milestone 1 tasks acquire `splittable = true` and `minimum_useful_block_minutes = 25`. Existing data, deadlines, timers, and dependencies are preserved. No availability, events, or schedule are fabricated on upgrade.

| Addition         | Stored data and constraints                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task fields      | Splittable boolean; minimum useful block of 1–90 minutes.                                                                                                                                                           |
| `events`         | ID, title, absolute UTC start/end, optional project FK/location/notes, `local` source, creation/update timestamps. End must follow start.                                                                           |
| `availability`   | ID, ISO weekday 1–7, local `HH:mm` start/end, enabled flag, explicit `America/Santiago`. Each window stays within one local day; multiple windows per day are allowed. Enabled windows on a weekday cannot overlap. |
| `plan_blocks`    | ID, task FK, absolute UTC start/end, locked flag, `scheduler` source, creation/update timestamps. Task and proposed schedule remain separate.                                                                       |
| `workspace_meta` | Singleton monotonically increasing revision. Triggers cover inserts, updates, and deletes in tasks, projects, timers, dependencies, events, availability, and blocks.                                               |
| `planning_state` | Last planning instant, horizon end, resulting workspace revision, and serialized explanatory warnings.                                                                                                              |

Range/lookup indexes support event and block reads. SQLite foreign keys, WAL, busy timeout, timer exclusivity, and the existing migration ledger remain in force. Availability replacement and schedule replacement are atomic. Events may overlap other fixed events; capacity subtracts their union rather than counting the overlap twice.

## Exact scheduling heuristic

The pure TypeScript scheduler takes a workspace snapshot and injected clock, reads that clock once, and returns blocks, warnings, and daily load. It does not read SQLite, invoke Tauri, or import React. The UI requests 42 local days, starting now and ending at the start of the day 42 days after today. The domain accepts horizons of 1–90 days.

1. Preserve every past or ongoing block (`startAt <= now`) and every locked future block, unchanged, including their metadata. Discard other future blocks from the calculation.
2. Expand enabled weekly availability into actual UTC intervals for each Santiago date. Clip to now/horizon, subtract fixed events, then subtract preserved reservations. These remaining intervals are the only capacity available to new work.
3. Reuse Milestone 1 eligibility: only inbox/todo tasks with an active or absent project and completed prerequisites qualify. Blocked, cancelled, completed, and currently running tasks receive no new blocks. A scheduled prerequisite is not assumed completed. Active-task warnings ask the user to stop its timer and replan with recorded time.
4. Compute remaining work as `max(0, estimate - recorded actual minutes - future preserved reservation minutes)`. Missing estimates assume 30 minutes, with a visible warning. Actual minutes come from closed TimeEntries. Only the future portion of an ongoing reservation counts, and only preserved minutes before the deadline count. Past proposed blocks never imply completed work. Unlocked future blocks are replaced, not credited twice.
5. Order eligible tasks by earliest deadline, then descending existing priority/risk score, oldest creation timestamp, and task ID. Tasks without deadlines sort after dated work and remain eligible. The existing risk thresholds and manual priority scoring are unchanged; risk is an elapsed-time heuristic, separate from capacity feasibility.
6. Greedily allocate each task into the earliest suitable free intervals, ending by its deadline or horizon. New blocks are at most 90 elapsed minutes. Splittable work may use several blocks and days. A partial block below `minimumUsefulBlockMinutes` is skipped. When possible, shorten an earlier block to leave a useful final block; a final block that contains all remaining work may be smaller than the minimum. An unsplittable task requires one fitting interval; estimates above the 90-minute maximum produce an explicit warning.
7. Subtract each allocated block from free capacity before allocating another. Return preserved and generated blocks in stable chronological order. Generated IDs derive from task/start/end; the same inputs and clock produce the same complete result without mutating the input.

There is no global optimization, inferred task completion, inserted break policy, or background replanning. Adjacent focus blocks are allowed. Fragmentation and minimum-block rules can prevent a complete plan even when aggregate capacity is sufficient. Estimates and deadlines are never changed to make work fit.

## Overload and conflicts

Before allocation, for each relevant deadline cutoff, sum remaining eligible work due by that cutoff and compare it with usable capacity between now and the cutoff, after events and preserved reservations. For example, 540 required minutes versus 300 available minutes creates a deadline-capacity warning with both numbers. Also compare total remaining demand with horizon capacity.

After allocation, report each task's unscheduled minutes and the deadline/horizon limiting it. Distinguish missing estimates, ineligibility, active timers, unsplittable work, and insufficient/fragmented capacity. No capacity is fabricated. Preserved blocks can become incompatible with edited events, availability, task status, or deadlines; keep them and report the conflict. New blocks still avoid those reservations. Day agendas show planned minutes versus full-day capacity after events and flag overcapacity/conflicts. Deadline risks appear in Week and Month; planning warnings remain visible in Today and Calendar.

Warnings describe the last explicit plan. Workspace revision changes produce a prominent stale-plan notice. Clock passage does not trigger autonomous scheduling: select Plan / Replan to refresh the forecast.

## Time and DST

Date-only deadlines remain local dates and end at the start of the next Santiago day. Timed deadlines, Events, PlanBlocks, and lifecycle timestamps are absolute UTC values. Intervals are half-open: touching endpoints do not overlap. Durations use elapsed milliseconds, not wall-clock subtraction.

Availability rules are local wall-clock windows. The engine intersects each window with the day's constant-offset segments: repeated hours contribute both valid occurrences, partial repeated windows retain the intervening unavailable gap, and nonexistent times contribute zero capacity. Santiago days can therefore have 23 or 25 elapsed hours. Event/deadline inputs reject ambiguous or nonexistent local instants rather than choosing one silently. Editing existing events retains timestamp precision.

Rust independently validates proposed block availability using `chrono-tz` at actual minute boundaries, including both sides of DST transitions. Frontend expansion uses the existing Temporal polyfill. Both timezone data sets should be kept current when Chilean rules change.

## Boundaries and write safety

React renders backend snapshots and submits explicit actions. The frontend application service loads a fresh snapshot, calls the pure scheduler, and sends its typed result through the Tauri adapter. Rust owns authoritative timestamps, identity creation, input validation, migrations, and SQL transactions. The new repository module owns calendar reads and writes; no browser storage is authoritative.

Schedule writes use an immediate transaction and expected workspace revision, rejecting data changed by another window/process during planning. The backend checks freshness/horizon, unique IDs, preservation of existing locked/past/ongoing blocks, eligibility, canonical UTC, availability, deadlines, the 90-minute maximum, and overlap constraints before replacing unlocked future blocks. Failed writes roll back. The resulting plan revision and warnings are saved together. Existing protected conflicts are preserved rather than silently repaired.

Today combines real fixed events, work blocks, timers, warnings, and the next eligible scheduled task (with the existing priority recommendation as fallback). Calendar uses a small custom agenda: Monday–Sunday Week, lightweight Month with deadline/load/risk indicators and selectable day agendas, local Event CRUD, Availability editor, and future block locks. Capacity starts at zero until enabled windows are saved. No new frontend dependency or calendar framework was added. `chrono-tz` is the only new Rust dependency; `serde_json` now also saves planning warnings.

No LLM, Inbox interpretation, Google service, OAuth, notification, or autonomous planning was added.

## Validation

The final review checks cover typecheck/build, ESLint, Prettier, Vitest, Rust integration tests, rustfmt, Cargo check, Clippy with warnings denied, and `git diff --check`. TypeScript has 51 passing tests (22 added); Rust has 25 passing integration tests (10 added). The new tests cover event/availability boundaries, multiple days, splitting/minimum blocks, deadline ordering, no deadlines, blocked/projects/prerequisites, all preserved block categories, recorded versus proposed work, overload (540 versus 300), no capacity, deterministic fixed-clock results/input immutability, DST gaps/repeated partial windows, calendar reopen persistence, event CRUD, atomic validation, stale revisions across connections, and migration from Milestone 1.

`pnpm tauri dev` successfully launched the native app against the isolated ignored `.validation/milestone2.sqlite3` database. Using native controls through the Computer Use plugin, created fictitious tasks with a Thursday date-only deadline/280-minute estimate, Wednesday date-only deadline/60-minute estimate, and no deadline/missing estimate (disclosed 30-minute assumption). Enabled Monday–Thursday 09:00–17:00 availability and created two fixed events. Planned work avoided events and unavailable time. Locked Wednesday 09:00–10:30, extended Wednesday's 10:40–11:40 event to 12:40, and replanned: the lock remained unchanged and later work moved after 12:40. The earlier-deadline task was allocated before the remaining Thursday work; undated work moved to Thursday when Wednesday's usable fragments were exhausted. Today, Week, and Month displayed saved data and warnings.

Stopped the development app, confirmed its window closed, then relaunched against the same database. Tasks, events, availability/capacity, warnings, generated blocks, and the locked reservation remained visible. This completes the native create/plan/replan/restart persistence scenario that Milestone 1's interrupted manual verification had left incomplete. Event deletion and invalid-data paths are covered by integration tests; no personal data was used. No commit, push, merge, or Milestone 3 work was performed.
