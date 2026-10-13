ALTER TABLE tasks ADD COLUMN splittable INTEGER NOT NULL DEFAULT 1 CHECK(splittable IN (0,1));
ALTER TABLE tasks ADD COLUMN minimum_useful_block_minutes INTEGER NOT NULL DEFAULT 25 CHECK(minimum_useful_block_minutes BETWEEN 1 AND 90);
CREATE TABLE events (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL CHECK(end_at > start_at),
    project_id TEXT REFERENCES projects(id) ON DELETE RESTRICT,
    location TEXT,
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'local' CHECK(source = 'local'),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX events_start ON events(start_at);
CREATE TABLE availability (
    id TEXT PRIMARY KEY NOT NULL,
    weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7),
    start_local TEXT NOT NULL,
    end_local TEXT NOT NULL CHECK(end_local > start_local),
    enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
    time_zone TEXT NOT NULL DEFAULT 'America/Santiago' CHECK(time_zone = 'America/Santiago')
);
CREATE TABLE plan_blocks (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL CHECK(end_at > start_at),
    locked INTEGER NOT NULL CHECK(locked IN (0,1)),
    source TEXT NOT NULL DEFAULT 'scheduler' CHECK(source = 'scheduler'),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX plan_blocks_start ON plan_blocks(start_at);
CREATE INDEX plan_blocks_task ON plan_blocks(task_id);
CREATE TABLE workspace_meta (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL);
INSERT INTO workspace_meta VALUES (1, 0);
CREATE TABLE planning_state (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    planned_at TEXT NOT NULL,
    horizon_end TEXT NOT NULL,
    revision INTEGER NOT NULL,
    warnings_json TEXT NOT NULL
);
CREATE TRIGGER revision_projects_INSERT AFTER INSERT ON projects BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_projects_UPDATE AFTER UPDATE ON projects BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_projects_DELETE AFTER DELETE ON projects BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_tasks_INSERT AFTER INSERT ON tasks BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_tasks_UPDATE AFTER UPDATE ON tasks BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_tasks_DELETE AFTER DELETE ON tasks BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_time_entries_INSERT AFTER INSERT ON time_entries BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_time_entries_UPDATE AFTER UPDATE ON time_entries BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_time_entries_DELETE AFTER DELETE ON time_entries BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_task_dependencies_INSERT AFTER INSERT ON task_dependencies BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_task_dependencies_UPDATE AFTER UPDATE ON task_dependencies BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_task_dependencies_DELETE AFTER DELETE ON task_dependencies BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_events_INSERT AFTER INSERT ON events BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_events_UPDATE AFTER UPDATE ON events BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_events_DELETE AFTER DELETE ON events BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_availability_INSERT AFTER INSERT ON availability BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_availability_UPDATE AFTER UPDATE ON availability BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_availability_DELETE AFTER DELETE ON availability BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_plan_blocks_INSERT AFTER INSERT ON plan_blocks BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_plan_blocks_UPDATE AFTER UPDATE ON plan_blocks BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER revision_plan_blocks_DELETE AFTER DELETE ON plan_blocks BEGIN UPDATE workspace_meta SET revision = revision + 1 WHERE id = 1; END;
