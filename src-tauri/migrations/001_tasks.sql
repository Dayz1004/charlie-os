CREATE TABLE projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
    description TEXT,
    status TEXT NOT NULL CHECK(status IN ('active', 'paused', 'completed', 'archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT,
    CHECK((status = 'archived') = (archived_at IS NOT NULL))
);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
    description TEXT,
    project_id TEXT REFERENCES projects(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK(status IN ('inbox', 'todo', 'in_progress', 'blocked', 'done', 'cancelled')),
    priority TEXT CHECK(priority IN ('low', 'normal', 'high')),
    deadline_kind TEXT CHECK(deadline_kind IN ('date', 'instant')),
    deadline_value TEXT,
    estimated_minutes INTEGER CHECK(estimated_minutes > 0 AND estimated_minutes <= 525600),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    CHECK((deadline_kind IS NULL) = (deadline_value IS NULL)),
    CHECK((status = 'done') = (completed_at IS NOT NULL))
);
CREATE INDEX tasks_project ON tasks(project_id);
CREATE INDEX tasks_status ON tasks(status);
CREATE UNIQUE INDEX one_active_task ON tasks((1)) WHERE status = 'in_progress';

CREATE TABLE time_entries (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_millis INTEGER CHECK(duration_millis >= 0),
    created_at TEXT NOT NULL,
    CHECK((ended_at IS NULL) = (duration_millis IS NULL))
);
CREATE INDEX time_entries_task ON time_entries(task_id);
CREATE UNIQUE INDEX one_open_time_entry ON time_entries((1)) WHERE ended_at IS NULL;
