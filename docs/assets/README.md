# Public demo captures

The Today, Week, and Month images in this directory are real desktop captures showing fictitious demo data. The root README uses Today as its hero and displays Week and Month in its Screenshots section. Follow this guide to reproduce or refresh the captures.

## Start an isolated demo

From the repository root in PowerShell, use a fresh unique database path:

```powershell
$demoName = 'showcase-' + [guid]::NewGuid().ToString('N') + '.sqlite3'
$env:CHARLIE_DB_PATH = Join-Path (Get-Location).Path ('.validation/' + $demoName)
$env:CHARLIE_SEED = '1'
pnpm tauri dev
```

The app creates the parent directory. The seed adds three fictitious projects, six tasks, two fixed events, weekday availability (09:00–20:00), and disabled weekends. It only runs when task/project/event/availability tables are empty. Both environment options are ignored in release builds; use the debug development command above.

Select **Planificar** to generate actual work blocks. Use a weekday during the enabled hours for a useful Today capture. If capturing later or on a weekend, adjust availability, deadlines, and events through the demo UI to make a meaningful plan for the real current date; do not change the system clock. The seeded large task intentionally demonstrates overload. Keep genuine warnings visible.

## Capture two views, optionally a third

Use one consistent theme and a window around 1440 × 960. Capture only the app window with the Windows screenshot tool; exclude desktop, terminal, notifications, and personal paths.

| File                   | Screen and composition                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `today.png`            | **Hoy**, after planning: summary, next task, upcoming fixed event, remaining agenda, and a readable capacity warning. This is the README hero.                           |
| `week.png`             | **Semana**, same plan: scroll the timeline to show work before/after a fixed event. Reserve a future block from the day agenda and replan so its reservation is visible. |
| `month.png` (optional) | **Mes**, same workspace: deadline labels, planned workload, and fixed events.                                                                                            |

Inspect every image at readable size. Confirm all titles come from the fictitious workspace and that no personal names, email addresses, calendars, paths, or databases are visible. Save the PNGs in this directory. Keep the root README image references aligned with the files actually captured (Month is optional).

Do not upload the demo database or logs. After closing the app and stopping the development process, clear this terminal's overrides:

```powershell
Remove-Item Env:CHARLIE_DB_PATH -ErrorAction SilentlyContinue
Remove-Item Env:CHARLIE_SEED -ErrorAction SilentlyContinue
```

The isolated database stays in ignored `.validation/` for later demo use. These captures do not by themselves complete the remaining native verification steps recorded in [Milestone 3](../MILESTONE_3.md#native-desktop-verification-and-remaining-checks).
