use crate::domain::*;
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension, Transaction, TransactionBehavior};

pub struct SqliteRepository {
    pub(crate) connection: Connection,
}

fn task_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Task> {
    let kind: Option<String> = row.get(6)?;
    let value: Option<String> = row.get(7)?;
    let deadline = match (kind.as_deref(), value) {
        (Some("date"), Some(value)) => Some(Deadline::Date { value }),
        (Some("instant"), Some(value)) => Some(Deadline::Instant { value }),
        _ => None,
    };
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        project_id: row.get(3)?,
        status: row.get(4)?,
        priority: row.get(5)?,
        deadline,
        estimated_minutes: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
        completed_at: row.get(11)?,
        actual_minutes: row.get(12)?,
        splittable: row.get(13)?,
        minimum_useful_block_minutes: row.get(14)?,
    })
}

pub(crate) fn require_task(tx: &Transaction<'_>, id: &str) -> Result<TaskStatus> {
    tx.query_row("SELECT status FROM tasks WHERE id = ?1", [id], |row| {
        row.get(0)
    })
    .optional()?
    .ok_or_else(|| AppError::validation("Task does not exist."))
}

pub(crate) fn require_project(connection: &Connection, id: Option<&str>) -> Result<()> {
    if let Some(id) = id {
        if !connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM projects WHERE id = ?1)",
            [id],
            |row| row.get::<_, bool>(0),
        )? {
            return Err(AppError::validation("Project does not exist."));
        }
    }
    Ok(())
}

fn close_timer(tx: &Transaction<'_>, id: &str, now: DateTime<Utc>) -> Result<()> {
    let open: Option<(String, String)> = tx
        .query_row(
            "SELECT id, started_at FROM time_entries WHERE task_id = ?1 AND ended_at IS NULL",
            [id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    if let Some((entry_id, start)) = open {
        let duration = elapsed_millis(&start, now)?;
        tx.execute(
            "UPDATE time_entries SET ended_at = ?1, duration_millis = ?2 WHERE id = ?3",
            params![timestamp(now), duration, entry_id],
        )?;
    }
    Ok(())
}

impl SqliteRepository {
    pub fn new(connection: Connection) -> Self {
        Self { connection }
    }

    pub fn snapshot(&mut self) -> Result<Snapshot> {
        let tx = self.connection.transaction()?;
        let projects = tx.prepare("SELECT id, name, description, status, created_at, updated_at, archived_at FROM projects ORDER BY created_at, id")?
            .query_map([], |row| Ok(Project { id: row.get(0)?, name: row.get(1)?, description: row.get(2)?, status: row.get(3)?, created_at: row.get(4)?, updated_at: row.get(5)?, archived_at: row.get(6)? }))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        let tasks = tx.prepare("SELECT t.id, t.title, t.description, t.project_id, t.status, t.priority, t.deadline_kind, t.deadline_value, t.estimated_minutes, t.created_at, t.updated_at, t.completed_at, COALESCE((SELECT SUM(duration_millis) / 60000.0 FROM time_entries WHERE task_id = t.id), 0.0), t.splittable, t.minimum_useful_block_minutes FROM tasks t ORDER BY created_at, id")?
            .query_map([], task_from_row)?.collect::<std::result::Result<Vec<_>, _>>()?;
        let time_entries = tx.prepare("SELECT id, task_id, started_at, ended_at, duration_millis / 60000.0, created_at FROM time_entries ORDER BY started_at, id")?
            .query_map([], |row| Ok(TimeEntry { id: row.get(0)?, task_id: row.get(1)?, started_at: row.get(2)?, ended_at: row.get(3)?, duration_minutes: row.get(4)?, created_at: row.get(5)? }))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        let dependencies = tx.prepare("SELECT task_id, depends_on_task_id FROM task_dependencies ORDER BY task_id, depends_on_task_id")?
            .query_map([], |row| Ok(TaskDependency { task_id: row.get(0)?, depends_on_task_id: row.get(1)? }))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        let calendar = crate::schedule_repository::read_calendar(&tx)?;
        tx.commit()?;
        Ok(Snapshot {
            projects,
            tasks,
            time_entries,
            dependencies,
            events: calendar.events,
            availability: calendar.availability,
            plan_blocks: calendar.blocks,
            revision: calendar.revision,
            planning_state: calendar.state,
        })
    }

    pub fn save_task(
        &mut self,
        id: &str,
        input: &TaskInput,
        now: &str,
        create: bool,
    ) -> Result<()> {
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        require_project(&tx, input.project_id.as_deref())?;
        if create && matches!(input.status, TaskStatus::InProgress | TaskStatus::Done) {
            return Err(AppError::validation(
                "Create an open task; use Start or Complete to change its lifecycle.",
            ));
        }
        if !create {
            let current = require_task(&tx, id)?;
            if (current == TaskStatus::InProgress) != (input.status == TaskStatus::InProgress) {
                return Err(AppError::conflict(
                    "Use Start, Stop, or Complete to change an active task.",
                ));
            }
            if input.status == TaskStatus::Done && current != TaskStatus::Done {
                return Err(AppError::validation("Use Complete to finish a task."));
            }
            // An active task must remain attached to an active project.
            if current == TaskStatus::InProgress {
                require_active_project(&tx, input.project_id.as_deref())?;
            }
        }
        let (kind, value) = input
            .deadline
            .as_ref()
            .map(|d| {
                let (k, v) = d.columns();
                (Some(k), Some(v))
            })
            .unwrap_or((None, None));
        if create {
            tx.execute("INSERT INTO tasks(id, title, description, project_id, status, priority, deadline_kind, deadline_value, estimated_minutes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
                params![id, input.title, input.description, input.project_id, input.status.as_str(), input.priority.map(|p| p.as_str()), kind, value, input.estimated_minutes, now])?;
        } else {
            tx.execute("UPDATE tasks SET title = ?2, description = ?3, project_id = ?4, status = ?5, priority = ?6, deadline_kind = ?7, deadline_value = ?8, estimated_minutes = ?9, updated_at = ?10, completed_at = CASE WHEN ?5 = 'done' THEN completed_at ELSE NULL END WHERE id = ?1",
                params![id, input.title, input.description, input.project_id, input.status.as_str(), input.priority.map(|p| p.as_str()), kind, value, input.estimated_minutes, now])?;
        }
        tx.execute(
            "UPDATE tasks SET splittable = ?2, minimum_useful_block_minutes = ?3 WHERE id = ?1",
            params![id, input.splittable, input.minimum_useful_block_minutes],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn save_project(
        &mut self,
        id: &str,
        input: &ProjectInput,
        now: &str,
        create: bool,
    ) -> Result<()> {
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        if !create {
            require_project(&tx, Some(id))?;
            if input.status != ProjectStatus::Active && tx.query_row("SELECT EXISTS(SELECT 1 FROM tasks WHERE project_id = ?1 AND status = 'in_progress')", [id], |r| r.get::<_, bool>(0))? {
                return Err(AppError::conflict("Stop or complete the active task before pausing or archiving its project."));
            }
        }
        let archived = (input.status == ProjectStatus::Archived).then_some(now);
        if create {
            tx.execute("INSERT INTO projects(id, name, description, status, created_at, updated_at, archived_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6)", params![id, input.name, input.description, input.status.as_str(), now, archived])?;
        } else {
            tx.execute("UPDATE projects SET name = ?2, description = ?3, status = ?4, updated_at = ?5, archived_at = CASE WHEN ?4 = 'archived' THEN COALESCE(archived_at, ?6) ELSE NULL END WHERE id = ?1", params![id, input.name, input.description, input.status.as_str(), now, archived])?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn start_task(&mut self, id: &str, entry_id: &str, now: &str) -> Result<()> {
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        if tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM time_entries WHERE ended_at IS NULL)",
            [],
            |r| r.get::<_, bool>(0),
        )? {
            return Err(AppError::conflict(
                "A task is already active. Stop or complete it first.",
            ));
        }
        let status = require_task(&tx, id)?;
        if !matches!(status, TaskStatus::Inbox | TaskStatus::Todo) {
            return Err(AppError::conflict(
                "Only open, unblocked tasks can be started.",
            ));
        }
        let project: Option<String> =
            tx.query_row("SELECT project_id FROM tasks WHERE id = ?1", [id], |r| {
                r.get(0)
            })?;
        require_active_project(&tx, project.as_deref())?;
        if tx.query_row("SELECT EXISTS(SELECT 1 FROM task_dependencies d JOIN tasks t ON t.id = d.depends_on_task_id WHERE d.task_id = ?1 AND t.status <> 'done')", [id], |r| r.get::<_, bool>(0))? {
            return Err(AppError::conflict("Complete this task's prerequisites before starting it."));
        }
        tx.execute(
            "INSERT INTO time_entries(id, task_id, started_at, created_at) VALUES (?1, ?2, ?3, ?3)",
            params![entry_id, id, now],
        )?;
        tx.execute(
            "UPDATE tasks SET status = 'in_progress', updated_at = ?2 WHERE id = ?1",
            params![id, now],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn finish_task(&mut self, id: &str, now: DateTime<Utc>, complete: bool) -> Result<()> {
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let status = require_task(&tx, id)?;
        if (!complete && status != TaskStatus::InProgress)
            || (complete && status == TaskStatus::Cancelled)
        {
            return Err(AppError::conflict(
                "This task cannot be stopped/completed in its current state.",
            ));
        }
        if complete && status == TaskStatus::Done {
            return Ok(());
        }
        close_timer(&tx, id, now)?;
        tx.execute(
            "UPDATE tasks SET status = ?2, updated_at = ?3, completed_at = ?4 WHERE id = ?1",
            params![
                id,
                if complete { "done" } else { "todo" },
                timestamp(now),
                complete.then(|| timestamp(now))
            ],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn set_dependencies(&mut self, id: &str, prerequisite_ids: &[String]) -> Result<()> {
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        if require_task(&tx, id)? == TaskStatus::InProgress {
            return Err(AppError::conflict(
                "Stop the task before changing its prerequisites.",
            ));
        }
        tx.execute("DELETE FROM task_dependencies WHERE task_id = ?1", [id])?;
        for prerequisite in prerequisite_ids {
            require_task(&tx, prerequisite)?;
            if prerequisite == id {
                return Err(AppError::validation("A task cannot depend on itself."));
            }
            tx.execute("INSERT OR IGNORE INTO task_dependencies(task_id, depends_on_task_id) VALUES (?1, ?2)", params![id, prerequisite])?;
        }
        let cyclic: bool = tx.query_row("WITH RECURSIVE ancestors(id) AS (SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?1 UNION SELECT d.depends_on_task_id FROM task_dependencies d JOIN ancestors a ON d.task_id = a.id) SELECT EXISTS(SELECT 1 FROM ancestors WHERE id = ?1)", [id], |r| r.get(0))?;
        if cyclic {
            return Err(AppError::validation("Dependencies cannot form a cycle."));
        }
        tx.commit()?;
        Ok(())
    }
}

fn require_active_project(connection: &Connection, project: Option<&str>) -> Result<()> {
    if let Some(id) = project {
        let status: ProjectStatus =
            connection.query_row("SELECT status FROM projects WHERE id = ?1", [id], |r| {
                r.get(0)
            })?;
        if status != ProjectStatus::Active {
            return Err(AppError::conflict(
                "The task's project must be active before starting.",
            ));
        }
    }
    Ok(())
}
