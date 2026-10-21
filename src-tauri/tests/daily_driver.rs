use charlie_os_lib::{application::TaskService, database, domain::*, repository::SqliteRepository};
use rusqlite::Connection;
use tempfile::TempDir;

#[test]
fn milestone_three_upgrade_preserves_legacy_projects_and_tasks() {
    let directory = TempDir::new().unwrap();
    let path = directory.path().join("upgrade.sqlite3");
    let mut connection = Connection::open(&path).unwrap();
    database::migrate(&mut connection, &database::MIGRATIONS[..3]).unwrap();
    connection.execute("INSERT INTO projects(id,name,status,created_at,updated_at) VALUES ('p','Legacy fixture','active','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')", []).unwrap();
    connection.execute("INSERT INTO tasks(id,title,project_id,status,estimated_minutes,deadline_kind,deadline_value,created_at,updated_at) VALUES ('t','Legacy work','p','todo',120,'date','2026-10-15','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')", []).unwrap();
    drop(connection);
    let mut app = TaskService::new(
        SqliteRepository::new(database::open(&path).unwrap()),
        SystemClock,
    );
    let snapshot = app.snapshot().unwrap();
    assert_eq!(snapshot.projects[0].color, "#6d8c80");
    assert_eq!(snapshot.tasks[0].estimated_minutes, Some(120));
    assert_eq!(snapshot.tasks[0].project_id.as_deref(), Some("p"));
    assert_eq!(snapshot.preferences.theme, "system");
    assert_eq!(snapshot.preferences.horizon_days, 42);
}

#[test]
fn colors_and_preferences_validate_and_survive_reopen() {
    let directory = TempDir::new().unwrap();
    let path = directory.path().join("preferences.sqlite3");
    let mut app = TaskService::new(
        SqliteRepository::new(database::open(&path).unwrap()),
        SystemClock,
    );
    let mut input = ProjectInput {
        name: "Fixture".into(),
        description: None,
        status: ProjectStatus::Active,
        color: "#AABBCC".into(),
    };
    let snapshot = app.create_project(input.clone()).unwrap();
    let id = snapshot.projects[0].id.clone();
    assert_eq!(snapshot.projects[0].color, "#aabbcc");
    input.color = "red".into();
    assert!(app.update_project(&id, input.clone()).is_err());
    input.color = "#12345z".into();
    assert!(app.update_project(&id, input).is_err());
    let before = app.snapshot().unwrap().revision;
    let preferences = Preferences {
        theme: "dark".into(),
        horizon_days: 42,
    };
    assert_eq!(app.save_preferences(&preferences).unwrap().revision, before);
    let preferences = Preferences {
        theme: "light".into(),
        horizon_days: 14,
    };
    assert!(app.save_preferences(&preferences).unwrap().revision > before);
    for invalid in [
        Preferences {
            theme: "invalid".into(),
            horizon_days: 14,
        },
        Preferences {
            theme: "dark".into(),
            horizon_days: 0,
        },
        Preferences {
            theme: "system".into(),
            horizon_days: 91,
        },
    ] {
        assert!(app.save_preferences(&invalid).is_err());
    }
    drop(app);
    let mut app = TaskService::new(
        SqliteRepository::new(database::open(&path).unwrap()),
        SystemClock,
    );
    let saved = app.snapshot().unwrap();
    assert_eq!(saved.projects[0].color, "#aabbcc");
    assert_eq!(saved.preferences.theme, "light");
    assert_eq!(saved.preferences.horizon_days, 14);
    let connection = database::open(&path).unwrap();
    assert!(connection
        .execute("UPDATE projects SET color = '#xxxxxx'", [])
        .is_err());
    assert!(connection
        .execute("UPDATE preferences SET horizon_days = 0", [])
        .is_err());
}
