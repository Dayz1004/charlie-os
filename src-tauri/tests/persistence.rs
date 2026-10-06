use charlie_os_lib::{application::TaskService, database, domain::*, repository::SqliteRepository};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use std::{
    path::Path,
    sync::{Arc, Mutex},
};
use tempfile::TempDir;

#[derive(Clone)]
struct FixedClock(Arc<Mutex<DateTime<Utc>>>);
impl FixedClock {
    fn new() -> Self {
        Self(Arc::new(Mutex::new(
            "2026-10-06T15:00:00Z".parse().unwrap(),
        )))
    }
    fn set(&self, time: &str) {
        *self.0.lock().unwrap() = time.parse().unwrap();
    }
}
impl Clock for FixedClock {
    fn now(&self) -> DateTime<Utc> {
        *self.0.lock().unwrap()
    }
}

fn service(path: &Path, clock: FixedClock) -> TaskService<FixedClock> {
    TaskService::new(SqliteRepository::new(database::open(path).unwrap()), clock)
}
fn input(title: &str) -> TaskInput {
    TaskInput {
        title: title.into(),
        description: None,
        project_id: None,
        status: TaskStatus::Todo,
        priority: None,
        deadline: None,
        estimated_minutes: Some(60),
    }
}
fn create(service: &mut TaskService<FixedClock>, title: &str) -> String {
    service
        .create_task(input(title))
        .unwrap()
        .tasks
        .iter()
        .find(|t| t.title == title)
        .unwrap()
        .id
        .clone()
}

#[test]
fn tasks_projects_updates_and_both_deadline_kinds_survive_restarts() {
    let directory = TempDir::new().unwrap();
    let path = directory.path().join("test.sqlite3");
    let clock = FixedClock::new();
    let mut app = service(&path, clock.clone());
    let project_id = app
        .create_project(ProjectInput {
            name: "Fixture project".into(),
            description: None,
            status: ProjectStatus::Active,
        })
        .unwrap()
        .projects[0]
        .id
        .clone();
    let mut draft = input("  Original  ");
    draft.project_id = Some(project_id.clone());
    draft.deadline = Some(Deadline::Date {
        value: "2026-10-07".into(),
    });
    let task = app.create_task(draft.clone()).unwrap().tasks.remove(0);
    assert_eq!(task.title, "Original");
    assert_eq!(task.created_at, "2026-10-06T15:00:00.000Z");
    draft.title = "Edited".into();
    draft.description = Some("Fictitious description".into());
    draft.priority = Some(Priority::High);
    draft.estimated_minutes = Some(90);
    clock.set("2026-10-06T16:00:00Z");
    app.update_task(&task.id, draft.clone()).unwrap();
    drop(app);
    let mut reopened = service(&path, clock.clone());
    let saved = reopened.snapshot().unwrap();
    assert_eq!(saved.projects[0].id, project_id);
    assert_eq!(saved.tasks[0].title, "Edited");
    assert_eq!(saved.tasks[0].description, draft.description);
    assert_eq!(saved.tasks[0].priority, Some(Priority::High));
    assert_eq!(saved.tasks[0].estimated_minutes, Some(90));
    assert_eq!(saved.tasks[0].deadline, draft.deadline);
    assert_eq!(saved.tasks[0].updated_at, "2026-10-06T16:00:00.000Z");
    draft.deadline = Some(Deadline::Instant {
        value: "2026-10-08T12:00:00-03:00".into(),
    });
    reopened.update_task(&task.id, draft).unwrap();
    drop(reopened);
    let saved = service(&path, clock).snapshot().unwrap();
    assert_eq!(
        saved.tasks[0].deadline,
        Some(Deadline::Instant {
            value: "2026-10-08T15:00:00.000Z".into()
        })
    );
}

#[test]
fn migrations_are_idempotent_and_upgrade_preserves_existing_data() {
    let directory = TempDir::new().unwrap();
    let path = directory.path().join("upgrade.sqlite3");
    let mut connection = Connection::open(&path).unwrap();
    database::migrate(&mut connection, &database::MIGRATIONS[..1]).unwrap();
    connection.execute("INSERT INTO tasks(id, title, status, created_at, updated_at) VALUES ('old', 'Legacy fixture', 'todo', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')", []).unwrap();
    drop(connection);
    let mut connection = database::open(&path).unwrap();
    database::migrate(&mut connection, database::MIGRATIONS).unwrap();
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        2
    );
    assert_eq!(
        connection
            .query_row("SELECT title FROM tasks WHERE id = 'old'", [], |r| r
                .get::<_, String>(0))
            .unwrap(),
        "Legacy fixture"
    );
    connection
        .prepare("SELECT * FROM task_dependencies")
        .unwrap();
}

#[test]
fn failed_migration_rolls_back_schema_and_ledger() {
    let mut connection = Connection::open_in_memory().unwrap();
    let migrations = [
        (1, "CREATE TABLE good(id INTEGER);"),
        (2, "CREATE TABLE partial(id INTEGER); INVALID SQL;"),
    ];
    assert!(database::migrate(&mut connection, &migrations).is_err());
    assert_eq!(
        connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        0
    );
}

#[test]
fn newer_or_modified_migration_history_is_rejected_without_changing_tasks() {
    let mut connection = Connection::open_in_memory().unwrap();
    database::migrate(&mut connection, database::MIGRATIONS).unwrap();
    assert!(database::migrate(&mut connection, &database::MIGRATIONS[..1]).is_err());
    connection
        .execute(
            "UPDATE schema_migrations SET sql = 'changed' WHERE version = 1",
            [],
        )
        .unwrap();
    assert!(database::migrate(&mut connection, database::MIGRATIONS).is_err());
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        2
    );
}

#[test]
fn single_active_invariant_holds_across_connections_and_restart() {
    let directory = TempDir::new().unwrap();
    let path = directory.path().join("active.sqlite3");
    let clock = FixedClock::new();
    let mut first = service(&path, clock.clone());
    let a = create(&mut first, "first");
    let b = create(&mut first, "second");
    first.start_task(&a).unwrap();
    let mut other = service(&path, clock.clone());
    assert_eq!(other.start_task(&b).unwrap_err().code, "conflict");
    assert!(first.start_task(&a).is_err());
    drop(first);
    let mut reopened = service(&path, clock.clone());
    let saved = reopened.snapshot().unwrap();
    assert_eq!(
        saved
            .time_entries
            .iter()
            .filter(|e| e.ended_at.is_none())
            .count(),
        1
    );
    assert_eq!(
        saved
            .tasks
            .iter()
            .filter(|t| t.status == TaskStatus::InProgress)
            .count(),
        1
    );
    clock.set("2026-10-06T15:01:30Z");
    reopened.stop_task(&a).unwrap();
    other.start_task(&b).unwrap();
    let saved = reopened.snapshot().unwrap();
    assert_eq!(
        saved
            .time_entries
            .iter()
            .filter(|e| e.ended_at.is_none())
            .count(),
        1
    );
    assert_eq!(
        saved
            .tasks
            .iter()
            .find(|t| t.id == a)
            .unwrap()
            .actual_minutes,
        1.5
    );
}

#[test]
fn sqlite_constraints_reject_two_open_timers_and_two_active_tasks() {
    let directory = TempDir::new().unwrap();
    let path = directory.path().join("constraints.sqlite3");
    let mut app = service(&path, FixedClock::new());
    let a = create(&mut app, "first");
    let b = create(&mut app, "second");
    app.start_task(&a).unwrap();
    let connection = database::open(&path).unwrap();
    assert!(connection.execute("INSERT INTO time_entries(id, task_id, started_at, created_at) VALUES ('bad', ?1, '2026-10-06T15:00:00Z', '2026-10-06T15:00:00Z')", [&b]).is_err());
    assert!(connection
        .execute(
            "UPDATE tasks SET status = 'in_progress' WHERE id = ?1",
            [&b]
        )
        .is_err());
    assert!(connection
        .execute(
            "UPDATE tasks SET project_id = 'missing' WHERE id = ?1",
            [&b]
        )
        .is_err());
}

#[test]
fn durations_accumulate_exactly_and_completion_closes_the_timer_once() {
    let directory = TempDir::new().unwrap();
    let path = directory.path().join("time.sqlite3");
    let clock = FixedClock::new();
    let mut app = service(&path, clock.clone());
    let id = create(&mut app, "timed");
    app.start_task(&id).unwrap();
    clock.set("2026-10-06T15:01:30.500Z");
    let stopped = app.stop_task(&id).unwrap();
    assert_eq!(stopped.tasks[0].status, TaskStatus::Todo);
    assert!((stopped.tasks[0].actual_minutes - 90.5 / 60.0).abs() < 1e-10);
    assert_eq!(stopped.time_entries[0].duration_minutes, Some(90.5 / 60.0));
    app.start_task(&id).unwrap();
    clock.set("2026-10-06T15:03:30.500Z");
    let done = app.complete_task(&id).unwrap();
    assert_eq!(done.tasks[0].status, TaskStatus::Done);
    assert_eq!(
        done.tasks[0].completed_at.as_deref(),
        Some("2026-10-06T15:03:30.500Z")
    );
    assert!((done.tasks[0].actual_minutes - 210.5 / 60.0).abs() < 1e-10);
    assert!(done.time_entries.iter().all(|e| e.ended_at.is_some()));
    assert_eq!(app.complete_task(&id).unwrap().time_entries.len(), 2);
    drop(app);
    assert!(
        (service(&path, clock).snapshot().unwrap().tasks[0].actual_minutes - 210.5 / 60.0).abs()
            < 1e-10
    );
}

#[test]
fn backward_clock_rolls_back_completion_and_zero_duration_is_allowed() {
    let directory = TempDir::new().unwrap();
    let clock = FixedClock::new();
    let mut app = service(&directory.path().join("clock.sqlite3"), clock.clone());
    let id = create(&mut app, "clock");
    app.start_task(&id).unwrap();
    clock.set("2026-10-06T14:59:59Z");
    assert!(app.complete_task(&id).is_err());
    let saved = app.snapshot().unwrap();
    assert_eq!(saved.tasks[0].status, TaskStatus::InProgress);
    assert!(saved.time_entries[0].ended_at.is_none());
    clock.set("2026-10-06T15:00:00Z");
    assert_eq!(
        app.stop_task(&id).unwrap().time_entries[0].duration_minutes,
        Some(0.0)
    );
}

#[test]
fn dependencies_gate_start_and_cycles_roll_back() {
    let directory = TempDir::new().unwrap();
    let mut app = service(
        &directory.path().join("dependencies.sqlite3"),
        FixedClock::new(),
    );
    let parent = create(&mut app, "prerequisite");
    let child = create(&mut app, "dependent");
    app.set_dependencies(&child, std::slice::from_ref(&parent))
        .unwrap();
    assert!(app.start_task(&child).is_err());
    assert!(app
        .set_dependencies(&parent, std::slice::from_ref(&child))
        .is_err());
    assert_eq!(app.snapshot().unwrap().dependencies.len(), 1);
    assert!(app.set_dependencies(&child, &["missing".into()]).is_err());
    assert_eq!(
        app.snapshot().unwrap().dependencies[0].depends_on_task_id,
        parent
    );
    app.complete_task(&parent).unwrap();
    app.start_task(&child).unwrap();
    assert!(app.set_dependencies(&child, &[]).is_err());
}

#[test]
fn active_status_cannot_be_bypassed_by_edit_and_blocked_tasks_cannot_start() {
    let directory = TempDir::new().unwrap();
    let mut app = service(&directory.path().join("states.sqlite3"), FixedClock::new());
    let id = create(&mut app, "open");
    let mut draft = input("open");
    draft.status = TaskStatus::InProgress;
    assert!(app.update_task(&id, draft.clone()).is_err());
    assert!(app.create_task(draft.clone()).is_err());
    draft.status = TaskStatus::Blocked;
    app.update_task(&id, draft.clone()).unwrap();
    assert!(app.start_task(&id).is_err());
    draft.status = TaskStatus::Todo;
    app.update_task(&id, draft.clone()).unwrap();
    app.start_task(&id).unwrap();
    assert!(app.update_task(&id, draft.clone()).is_err());
    draft.status = TaskStatus::InProgress;
    draft.title = "Edited while active".into();
    app.update_task(&id, draft).unwrap();
    assert_eq!(app.snapshot().unwrap().time_entries.len(), 1);
}

#[test]
fn completing_another_task_does_not_stop_the_active_timer_and_done_can_reopen() {
    let directory = TempDir::new().unwrap();
    let mut app = service(
        &directory.path().join("complete.sqlite3"),
        FixedClock::new(),
    );
    let a = create(&mut app, "active");
    let b = create(&mut app, "other");
    app.start_task(&a).unwrap();
    app.complete_task(&b).unwrap();
    let saved = app.update_task(&b, input("reopened")).unwrap();
    assert!(saved.time_entries[0].ended_at.is_none());
    let reopened = saved.tasks.iter().find(|t| t.id == b).unwrap();
    assert_eq!(reopened.status, TaskStatus::Todo);
    assert!(reopened.completed_at.is_none());
}

#[test]
fn invalid_inputs_do_not_write_partial_data() {
    let directory = TempDir::new().unwrap();
    let mut app = service(&directory.path().join("invalid.sqlite3"), FixedClock::new());
    for estimate in [0, -1, 525601] {
        let mut draft = input("invalid");
        draft.estimated_minutes = Some(estimate);
        assert!(app.create_task(draft).is_err());
    }
    for date in ["2026-02-30", "2026-2-01", "0000-01-01"] {
        let mut draft = input("invalid");
        draft.deadline = Some(Deadline::Date { value: date.into() });
        assert!(app.create_task(draft).is_err());
    }
    let mut draft = input("invalid");
    draft.project_id = Some("missing".into());
    assert!(app.create_task(draft).is_err());
    assert!(app.create_task(input(" ")).is_err());
    assert!(app.snapshot().unwrap().tasks.is_empty());
}

#[test]
fn paused_projects_gate_start_and_cannot_be_archived_with_an_active_task() {
    let directory = TempDir::new().unwrap();
    let mut app = service(
        &directory.path().join("projects.sqlite3"),
        FixedClock::new(),
    );
    let mut project = ProjectInput {
        name: "Fixture".into(),
        description: None,
        status: ProjectStatus::Paused,
    };
    let p = app.create_project(project.clone()).unwrap().projects[0]
        .id
        .clone();
    let mut draft = input("project task");
    draft.project_id = Some(p.clone());
    let id = app.create_task(draft).unwrap().tasks[0].id.clone();
    assert!(app.start_task(&id).is_err());
    project.status = ProjectStatus::Active;
    app.update_project(&p, project.clone()).unwrap();
    app.start_task(&id).unwrap();
    project.status = ProjectStatus::Archived;
    assert!(app.update_project(&p, project.clone()).is_err());
    app.stop_task(&id).unwrap();
    assert!(app.update_project(&p, project).unwrap().projects[0]
        .archived_at
        .is_some());
}

#[test]
fn wire_contract_uses_camel_case_tagged_deadlines_and_nullable_fields() {
    let directory = TempDir::new().unwrap();
    let mut app = service(&directory.path().join("wire.sqlite3"), FixedClock::new());
    let parsed: TaskInput = serde_json::from_value(serde_json::json!({
        "title": "Wire fixture", "description": null, "projectId": null, "status": "todo",
        "priority": null, "deadline": { "kind": "date", "value": "2026-10-06" }, "estimatedMinutes": null
    })).unwrap();
    let json = serde_json::to_value(app.create_task(parsed).unwrap()).unwrap();
    assert_eq!(json["tasks"][0]["deadline"]["kind"], "date");
    assert_eq!(json["tasks"][0]["actualMinutes"], 0.0);
    assert!(json["tasks"][0]["completedAt"].is_null());
    assert!(json["timeEntries"].is_array());
    assert!(json["tasks"][0].get("project_id").is_none());
}

#[test]
fn foreign_keys_and_duration_checks_protect_the_schema() {
    let directory = TempDir::new().unwrap();
    let path = directory.path().join("checks.sqlite3");
    let mut app = service(&path, FixedClock::new());
    let id = create(&mut app, "checks");
    app.start_task(&id).unwrap();
    let connection = database::open(&path).unwrap();
    assert!(connection
        .execute(
            "UPDATE time_entries SET ended_at = ?1, duration_millis = -1",
            params!["2026-10-06T15:00:00Z"]
        )
        .is_err());
    assert!(connection
        .execute("DELETE FROM tasks WHERE id = ?1", [&id])
        .is_err());
}
