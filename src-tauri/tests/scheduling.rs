use charlie_os_lib::{
    application::TaskService, calendar::*, database, domain::*, repository::SqliteRepository,
};
use chrono::{DateTime, Utc};
use std::path::Path;
use tempfile::TempDir;

#[derive(Clone)]
struct FixedClock;
impl Clock for FixedClock {
    fn now(&self) -> DateTime<Utc> {
        "2026-10-06T11:00:00Z".parse().unwrap()
    }
}
fn app(path: &Path) -> TaskService<FixedClock> {
    TaskService::new(
        SqliteRepository::new(database::open(path).unwrap()),
        FixedClock,
    )
}
fn task(title: &str) -> TaskInput {
    TaskInput {
        title: title.into(),
        description: None,
        project_id: None,
        status: TaskStatus::Todo,
        priority: None,
        deadline: None,
        estimated_minutes: Some(120),
        splittable: true,
        minimum_useful_block_minutes: 25,
    }
}
fn rule(weekday: i64, start: &str, end: &str, enabled: bool) -> AvailabilityInput {
    AvailabilityInput {
        weekday,
        start_local: start.into(),
        end_local: end.into(),
        enabled,
    }
}
fn event() -> EventInput {
    EventInput {
        title: "Fictitious meeting".into(),
        start_at: "2026-10-06T10:00:00-03:00".into(),
        end_at: "2026-10-06T11:00:00-03:00".into(),
        project_id: None,
        notes: Some("Fixture".into()),
        location: Some("Local".into()),
    }
}
fn block(id: &str, task_id: &str, start: &str, end: &str) -> PlanBlock {
    PlanBlock {
        id: id.into(),
        task_id: task_id.into(),
        start_at: start.into(),
        end_at: end.into(),
        locked: false,
        source: "scheduler".into(),
        created_at: "2026-10-06T11:00:00.000Z".into(),
        updated_at: "2026-10-06T11:00:00.000Z".into(),
    }
}
fn plan(snapshot: &Snapshot, blocks: Vec<PlanBlock>) -> ScheduleInput {
    ScheduleInput {
        expected_revision: snapshot.revision,
        planned_at: "2026-10-06T11:00:00.000Z".into(),
        horizon_end: "2026-10-08T03:00:00.000Z".into(),
        blocks,
        warnings: vec![],
    }
}
fn fixture(app: &mut TaskService<FixedClock>) -> String {
    app.replace_availability(&[
        rule(2, "09:00", "17:00", true),
        rule(3, "09:00", "17:00", true),
    ])
    .unwrap();
    app.create_task(task("Fictitious task")).unwrap().tasks[0]
        .id
        .clone()
}

#[test]
fn events_availability_plan_blocks_and_warnings_survive_reopen() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("calendar.sqlite3");
    let mut service = app(&path);
    let id = fixture(&mut service);
    let snapshot = service.save_event(None, event()).unwrap();
    assert_eq!(snapshot.events[0].start_at, "2026-10-06T13:00:00.000Z");
    let mut input = plan(
        &snapshot,
        vec![block(
            "work",
            &id,
            "2026-10-06T12:00:00.000Z",
            "2026-10-06T13:00:00.000Z",
        )],
    );
    input.warnings.push(PlanningWarning {
        code: "fixture".into(),
        message: "Fictitious warning".into(),
        task_id: Some(id),
        at: None,
        required_minutes: Some(120.0),
        capacity_minutes: Some(60.0),
    });
    service.replace_schedule(&input).unwrap();
    let saved = service.set_block_locked("work", true).unwrap();
    let locked = saved.plan_blocks[0].clone();
    drop(service);
    let reopened = app(&path).snapshot().unwrap();
    assert_eq!(reopened.events.len(), 1);
    assert_eq!(reopened.events[0].notes.as_deref(), Some("Fixture"));
    assert_eq!(reopened.availability.len(), 2);
    assert_eq!(reopened.availability[0].time_zone, "America/Santiago");
    assert_eq!(reopened.plan_blocks[0], locked);
    assert_eq!(
        reopened.planning_state.unwrap().warnings[0].message,
        "Fictitious warning"
    );
}

#[test]
fn event_update_delete_and_invalid_ranges_preserve_data() {
    let dir = TempDir::new().unwrap();
    let mut service = app(&dir.path().join("events.sqlite3"));
    let mut input = event();
    let saved = service.save_event(None, input.clone()).unwrap();
    let id = saved.events[0].id.clone();
    input.title = "Edited event".into();
    input.start_at = "2026-10-06T12:00:00-03:00".into();
    input.end_at = "2026-10-06T13:00:00-03:00".into();
    assert_eq!(
        service.save_event(Some(&id), input.clone()).unwrap().events[0].title,
        "Edited event"
    );
    input.end_at = input.start_at.clone();
    assert!(service.save_event(Some(&id), input).is_err());
    assert_eq!(
        service.snapshot().unwrap().events[0].end_at,
        "2026-10-06T16:00:00.000Z"
    );
    assert!(service.delete_event(&id).unwrap().events.is_empty());
    assert!(service.delete_event(&id).is_err());
}

#[test]
fn invalid_availability_is_rejected_atomically_and_disabled_windows_persist() {
    let dir = TempDir::new().unwrap();
    let mut service = app(&dir.path().join("availability.sqlite3"));
    service
        .replace_availability(&[
            rule(2, "09:00", "17:00", true),
            rule(7, "10:00", "12:00", false),
        ])
        .unwrap();
    assert!(service
        .replace_availability(&[
            rule(2, "09:00", "12:00", true),
            rule(2, "11:00", "14:00", true)
        ])
        .is_err());
    assert!(service
        .replace_availability(&[rule(8, "09:00", "10:00", true)])
        .is_err());
    assert!(service
        .replace_availability(&[rule(2, "17:00", "09:00", true)])
        .is_err());
    assert!(service
        .replace_availability(&[rule(2, "9:00", "10:00", true)])
        .is_err());
    let saved = service.snapshot().unwrap();
    assert_eq!(saved.availability.len(), 2);
    assert!(!saved.availability[1].enabled);
}

#[test]
fn stale_plans_are_rejected_after_another_connection_changes_the_workspace() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("stale.sqlite3");
    let mut service = app(&path);
    let id = fixture(&mut service);
    let snapshot = service.snapshot().unwrap();
    let input = plan(
        &snapshot,
        vec![block(
            "work",
            &id,
            "2026-10-06T12:00:00.000Z",
            "2026-10-06T13:00:00.000Z",
        )],
    );
    app(&path).save_event(None, event()).unwrap();
    assert_eq!(
        service.replace_schedule(&input).unwrap_err().code,
        "conflict"
    );
    assert!(service.snapshot().unwrap().plan_blocks.is_empty());
}

#[test]
fn replanning_preserves_locked_and_past_blocks_and_replaces_only_future_unlocked() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("replan.sqlite3");
    let mut service = app(&path);
    let id = fixture(&mut service);
    let snapshot = service.snapshot().unwrap();
    let initial = plan(
        &snapshot,
        vec![
            block(
                "locked",
                &id,
                "2026-10-06T12:00:00.000Z",
                "2026-10-06T13:00:00.000Z",
            ),
            block(
                "replace",
                &id,
                "2026-10-06T14:00:00.000Z",
                "2026-10-06T15:00:00.000Z",
            ),
        ],
    );
    service.replace_schedule(&initial).unwrap();
    service.set_block_locked("locked", true).unwrap();
    let connection = database::open(&path).unwrap();
    connection.execute("INSERT INTO plan_blocks(id,task_id,start_at,end_at,locked,created_at,updated_at) VALUES ('past',?1,'2026-10-05T12:00:00.000Z','2026-10-05T13:00:00.000Z',0,'2026-10-05T11:00:00.000Z','2026-10-05T11:00:00.000Z')",[&id]).unwrap();
    let snapshot = service.snapshot().unwrap();
    let preserved: Vec<PlanBlock> = snapshot
        .plan_blocks
        .iter()
        .filter(|b| b.id != "replace")
        .cloned()
        .collect();
    let mut missing = plan(&snapshot, vec![]);
    assert!(service.replace_schedule(&missing).is_err());
    missing.blocks = preserved.clone();
    missing.blocks.push(block(
        "new",
        &id,
        "2026-10-06T16:00:00.000Z",
        "2026-10-06T17:00:00.000Z",
    ));
    let saved = service.replace_schedule(&missing).unwrap();
    for b in &preserved {
        assert!(saved.plan_blocks.iter().any(|x| x == b));
    }
    assert!(!saved.plan_blocks.iter().any(|b| b.id == "replace"));
    assert!(service.set_block_locked("past", true).is_err());
    let state = saved.planning_state.unwrap();
    assert_eq!(state.revision, saved.revision);
}

#[test]
fn invalid_new_blocks_cannot_overlap_events_each_other_or_unavailable_time() {
    let dir = TempDir::new().unwrap();
    let mut service = app(&dir.path().join("invariants.sqlite3"));
    let id = fixture(&mut service);
    let snapshot = service.save_event(None, event()).unwrap();
    for (a, b) in [
        ("2026-10-06T13:00:00.000Z", "2026-10-06T14:00:00.000Z"),
        ("2026-10-06T10:00:00.000Z", "2026-10-06T11:00:00.000Z"),
        ("2026-10-06T19:30:00.000Z", "2026-10-06T20:30:00.000Z"),
        ("2026-10-06T14:00:00.000Z", "2026-10-06T16:00:00.000Z"),
    ] {
        assert!(service
            .replace_schedule(&plan(&snapshot, vec![block("bad", &id, a, b)]))
            .is_err());
    }
    let input = plan(
        &snapshot,
        vec![
            block(
                "a",
                &id,
                "2026-10-06T14:00:00.000Z",
                "2026-10-06T15:00:00.000Z",
            ),
            block(
                "b",
                &id,
                "2026-10-06T14:30:00.000Z",
                "2026-10-06T15:30:00.000Z",
            ),
        ],
    );
    assert!(service.replace_schedule(&input).is_err());
    assert!(service.snapshot().unwrap().plan_blocks.is_empty());
}

#[test]
fn blocked_tasks_and_deadline_violations_are_rejected() {
    let dir = TempDir::new().unwrap();
    let mut service = app(&dir.path().join("tasks.sqlite3"));
    let id = fixture(&mut service);
    let mut draft = task("Fictitious task");
    draft.status = TaskStatus::Blocked;
    let snapshot = service.update_task(&id, draft.clone()).unwrap();
    assert!(service
        .replace_schedule(&plan(
            &snapshot,
            vec![block(
                "a",
                &id,
                "2026-10-06T14:00:00.000Z",
                "2026-10-06T15:00:00.000Z"
            )]
        ))
        .is_err());
    draft.status = TaskStatus::Todo;
    draft.deadline = Some(Deadline::Instant {
        value: "2026-10-06T14:30:00Z".into(),
    });
    let snapshot = service.update_task(&id, draft).unwrap();
    assert!(service
        .replace_schedule(&plan(
            &snapshot,
            vec![block(
                "a",
                &id,
                "2026-10-06T14:00:00.000Z",
                "2026-10-06T15:00:00.000Z"
            )]
        ))
        .is_err());
}

#[test]
fn schema_upgrade_from_milestone_one_keeps_tasks_and_adds_safe_defaults() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("upgrade.sqlite3");
    let mut connection = rusqlite::Connection::open(&path).unwrap();
    database::migrate(&mut connection, &database::MIGRATIONS[..2]).unwrap();
    connection.execute("INSERT INTO tasks(id,title,status,estimated_minutes,created_at,updated_at) VALUES ('legacy','Old task','todo',120,'2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')",[]).unwrap();
    drop(connection);
    let saved = app(&path).snapshot().unwrap();
    assert_eq!(saved.tasks[0].id, "legacy");
    assert!(saved.tasks[0].splittable);
    assert_eq!(saved.tasks[0].minimum_useful_block_minutes, 25);
    assert!(saved.availability.is_empty());
}

#[test]
fn task_updates_and_timer_actions_mark_a_saved_schedule_stale() {
    let dir = TempDir::new().unwrap();
    let mut service = app(&dir.path().join("revision.sqlite3"));
    let id = fixture(&mut service);
    let snapshot = service.snapshot().unwrap();
    let saved = service
        .replace_schedule(&plan(
            &snapshot,
            vec![block(
                "a",
                &id,
                "2026-10-06T14:00:00.000Z",
                "2026-10-06T15:00:00.000Z",
            )],
        ))
        .unwrap();
    assert_eq!(
        saved.planning_state.as_ref().unwrap().revision,
        saved.revision
    );
    let started = service.start_task(&id).unwrap();
    assert!(started.revision > saved.revision);
    assert_ne!(started.planning_state.unwrap().revision, started.revision);
}

#[test]
fn dst_repeated_windows_do_not_allow_the_unavailable_gap() {
    #[derive(Clone)]
    struct DstClock;
    impl Clock for DstClock {
        fn now(&self) -> DateTime<Utc> {
            "2026-04-04T03:00:00Z".parse().unwrap()
        }
    }
    let dir = TempDir::new().unwrap();
    let connection = database::open(&dir.path().join("dst.sqlite3")).unwrap();
    let mut service = TaskService::new(SqliteRepository::new(connection), DstClock);
    service
        .replace_availability(&[rule(6, "23:00", "23:45", true)])
        .unwrap();
    let saved = service.create_task(task("DST fixture")).unwrap();
    let id = &saved.tasks[0].id;
    let mut a = block(
        "a",
        id,
        "2026-04-05T02:00:00.000Z",
        "2026-04-05T02:45:00.000Z",
    );
    a.created_at = "2026-04-04T03:00:00.000Z".into();
    a.updated_at = a.created_at.clone();
    let mut b = a.clone();
    b.id = "b".into();
    b.start_at = "2026-04-05T03:00:00.000Z".into();
    b.end_at = "2026-04-05T03:45:00.000Z".into();
    let input = ScheduleInput {
        expected_revision: saved.revision,
        planned_at: a.created_at.clone(),
        horizon_end: "2026-04-06T04:00:00.000Z".into(),
        blocks: vec![a, b],
        warnings: vec![],
    };
    service.replace_schedule(&input).unwrap();
    let snapshot = service.snapshot().unwrap();
    let mut bad = input.clone();
    bad.expected_revision = snapshot.revision;
    bad.blocks[0].end_at = "2026-04-05T03:15:00.000Z".into();
    bad.blocks.pop();
    assert!(service.replace_schedule(&bad).is_err());
}
