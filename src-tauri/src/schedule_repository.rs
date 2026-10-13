use crate::{
    calendar::*,
    domain::*,
    repository::{require_project, require_task, SqliteRepository},
};
use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Timelike, Utc};
use chrono_tz::America::Santiago;
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use std::collections::HashSet;
use uuid::Uuid;

pub(crate) struct CalendarData {
    pub events: Vec<CalendarEvent>,
    pub availability: Vec<Availability>,
    pub blocks: Vec<PlanBlock>,
    pub revision: i64,
    pub state: Option<PlanningState>,
}
pub(crate) fn read_calendar(connection: &Connection) -> Result<CalendarData> {
    let events = connection.prepare("SELECT id,title,start_at,end_at,project_id,location,notes,source,created_at,updated_at FROM events ORDER BY start_at,id")?
        .query_map([], |r| Ok(CalendarEvent { id:r.get(0)?,title:r.get(1)?,start_at:r.get(2)?,end_at:r.get(3)?,project_id:r.get(4)?,location:r.get(5)?,notes:r.get(6)?,source:r.get(7)?,created_at:r.get(8)?,updated_at:r.get(9)? }))?
        .collect::<std::result::Result<Vec<_>,_>>()?;
    let availability = connection.prepare("SELECT id,weekday,start_local,end_local,enabled,time_zone FROM availability ORDER BY weekday,start_local,id")?
        .query_map([], |r| Ok(Availability {id:r.get(0)?,weekday:r.get(1)?,start_local:r.get(2)?,end_local:r.get(3)?,enabled:r.get(4)?,time_zone:r.get(5)?}))?
        .collect::<std::result::Result<Vec<_>,_>>()?;
    let blocks = connection.prepare("SELECT id,task_id,start_at,end_at,locked,source,created_at,updated_at FROM plan_blocks ORDER BY start_at,id")?
        .query_map([], |r| Ok(PlanBlock {id:r.get(0)?,task_id:r.get(1)?,start_at:r.get(2)?,end_at:r.get(3)?,locked:r.get(4)?,source:r.get(5)?,created_at:r.get(6)?,updated_at:r.get(7)?}))?
        .collect::<std::result::Result<Vec<_>,_>>()?;
    let revision =
        connection.query_row("SELECT revision FROM workspace_meta WHERE id=1", [], |r| {
            r.get(0)
        })?;
    let raw: Option<(String, String, i64, String)> = connection
        .query_row(
            "SELECT planned_at,horizon_end,revision,warnings_json FROM planning_state WHERE id=1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .optional()?;
    let state = raw
        .map(
            |(planned_at, horizon_end, revision, json)| -> Result<PlanningState> {
                let warnings = serde_json::from_str(&json).map_err(|_| {
                    AppError::validation("Stored planning warnings could not be read.")
                })?;
                Ok(PlanningState {
                    planned_at,
                    horizon_end,
                    revision,
                    warnings,
                })
            },
        )
        .transpose()?;
    Ok(CalendarData {
        events,
        availability,
        blocks,
        revision,
        state,
    })
}

fn overlap(a: &PlanBlock, b: &PlanBlock) -> bool {
    a.start_at < b.end_at && b.start_at < a.end_at
}

pub(crate) fn within_availability(
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    rules: &[Availability],
) -> Result<bool> {
    let mut point = start;
    while point < end {
        let local = point.with_timezone(&Santiago);
        let mut allowed = false;
        for rule in rules
            .iter()
            .filter(|r| r.enabled && r.weekday == i64::from(local.weekday().number_from_monday()))
        {
            if local.time() >= local_time(&rule.start_local)?
                && local.time() < local_time(&rule.end_local)?
            {
                allowed = true;
                break;
            }
        }
        if !allowed {
            return Ok(false);
        }
        // Check every actual UTC minute boundary, including both sides of DST jumps.
        point = point.with_second(0).unwrap().with_nanosecond(0).unwrap() + Duration::minutes(1);
    }
    Ok(true)
}

fn deadline_end(kind: &str, value: &str) -> Result<DateTime<Utc>> {
    if kind == "instant" {
        return parse_instant(value);
    }
    let date = NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| AppError::validation("Invalid stored deadline."))?
        .succ_opt()
        .ok_or_else(|| AppError::validation("Deadline outside supported range."))?;
    let midnight = date.and_hms_opt(0, 0, 0).unwrap();
    for minute in 0..1440 {
        if let Some(time) = Santiago
            .from_local_datetime(&(midnight + Duration::minutes(minute)))
            .earliest()
        {
            return Ok(time.with_timezone(&Utc));
        }
    }
    Err(AppError::validation(
        "Deadline day does not exist in Santiago.",
    ))
}

impl SqliteRepository {
    pub fn save_event(
        &mut self,
        id: &str,
        input: &EventInput,
        now: &str,
        create: bool,
    ) -> Result<()> {
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        require_project(&tx, input.project_id.as_deref())?;
        if create {
            tx.execute("INSERT INTO events(id,title,start_at,end_at,project_id,location,notes,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?8)",params![id,input.title,input.start_at,input.end_at,input.project_id,input.location,input.notes,now])?;
        } else if tx.execute("UPDATE events SET title=?2,start_at=?3,end_at=?4,project_id=?5,location=?6,notes=?7,updated_at=?8 WHERE id=?1",params![id,input.title,input.start_at,input.end_at,input.project_id,input.location,input.notes,now])? == 0 {
            return Err(AppError::validation("Event does not exist."));
        }
        tx.commit()?;
        Ok(())
    }
    pub fn delete_event(&mut self, id: &str) -> Result<()> {
        if self
            .connection
            .execute("DELETE FROM events WHERE id=?1", [id])?
            == 0
        {
            return Err(AppError::validation("Event does not exist."));
        }
        Ok(())
    }
    pub fn replace_availability(&mut self, rules: &[AvailabilityInput]) -> Result<()> {
        if rules.len() > 100 {
            return Err(AppError::validation(
                "Use at most 100 weekly availability windows.",
            ));
        }
        for (index, rule) in rules.iter().enumerate() {
            rule.validate()?;
            if rule.enabled
                && rules[..index].iter().any(|r| {
                    r.enabled
                        && r.weekday == rule.weekday
                        && r.start_local < rule.end_local
                        && rule.start_local < r.end_local
                })
            {
                return Err(AppError::validation(
                    "Enabled availability windows on the same weekday cannot overlap.",
                ));
            }
        }
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.execute("DELETE FROM availability", [])?;
        for rule in rules {
            tx.execute("INSERT INTO availability(id,weekday,start_local,end_local,enabled) VALUES (?1,?2,?3,?4,?5)",params![Uuid::new_v4().to_string(),rule.weekday,rule.start_local,rule.end_local,rule.enabled])?;
        }
        tx.commit()?;
        Ok(())
    }
    pub fn set_block_locked(&mut self, id: &str, locked: bool, now: DateTime<Utc>) -> Result<()> {
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let start: Option<String> = tx
            .query_row("SELECT start_at FROM plan_blocks WHERE id=?1", [id], |r| {
                r.get(0)
            })
            .optional()?;
        let start = start.ok_or_else(|| AppError::validation("Plan block does not exist."))?;
        if parse_instant(&start)? <= now {
            return Err(AppError::conflict("Past and ongoing blocks are preserved; only future blocks can be locked or unlocked."));
        }
        tx.execute(
            "UPDATE plan_blocks SET locked=?2,updated_at=?3 WHERE id=?1",
            params![id, locked, timestamp(now)],
        )?;
        tx.commit()?;
        Ok(())
    }
    pub fn replace_schedule(&mut self, input: &ScheduleInput, now: DateTime<Utc>) -> Result<()> {
        let planned_at = parse_instant(&input.planned_at)?;
        let horizon_end = parse_instant(&input.horizon_end)?;
        if planned_at > now
            || now - planned_at > Duration::seconds(30)
            || horizon_end <= planned_at
            || horizon_end - planned_at > Duration::days(91)
        {
            return Err(AppError::conflict(
                "The planning clock/horizon is stale or invalid. Refresh and replan.",
            ));
        }
        if input.blocks.len() > 20000 || input.warnings.len() > 5000 {
            return Err(AppError::validation("Plan exceeds supported size."));
        }
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let current = read_calendar(&tx)?;
        if current.revision != input.expected_revision {
            return Err(AppError::conflict(
                "Tasks or calendar data changed while planning. Refresh and replan.",
            ));
        }
        let protected: Vec<&PlanBlock> = current
            .blocks
            .iter()
            .filter(|b| b.locked || b.start_at <= timestamp(now))
            .collect();
        for block in &protected {
            if !input.blocks.iter().any(|b| b == *block) {
                return Err(AppError::conflict(
                    "Replanning must preserve every past, ongoing, and locked block unchanged.",
                ));
            }
        }
        let protected_ids: HashSet<&str> = protected.iter().map(|b| b.id.as_str()).collect();
        let mut ids = HashSet::new();
        for block in &input.blocks {
            if !ids.insert(&block.id) {
                return Err(AppError::validation("Plan block IDs must be unique."));
            }
            if protected_ids.contains(block.id.as_str()) {
                continue;
            }
            let start = parse_instant(&block.start_at)?;
            let end = parse_instant(&block.end_at)?;
            if block.locked
                || block.source != "scheduler"
                || start < planned_at
                || end > horizon_end
                || end <= start
                || end - start > Duration::minutes(90)
                || timestamp(start) != block.start_at
                || timestamp(end) != block.end_at
                || block.created_at != input.planned_at
                || block.updated_at != input.planned_at
            {
                return Err(AppError::validation("New blocks must be unlocked, canonical UTC, within the horizon, and at most 90 minutes."));
            }
            let status = require_task(&tx, &block.task_id)?;
            if !matches!(status, TaskStatus::Todo | TaskStatus::Inbox) {
                return Err(AppError::conflict("Cannot schedule an unavailable task."));
            }
            let unavailable:bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=?1 AND p.status<>'active') OR EXISTS(SELECT 1 FROM task_dependencies d JOIN tasks t ON t.id=d.depends_on_task_id WHERE d.task_id=?1 AND t.status<>'done')",[&block.task_id],|r|r.get(0))?;
            if unavailable {
                return Err(AppError::conflict(
                    "Task project/prerequisites prevent scheduling.",
                ));
            }
            if !within_availability(start, end, &current.availability)? {
                return Err(AppError::validation("Plan block is outside availability."));
            }
            if current
                .events
                .iter()
                .any(|e| block.start_at < e.end_at && e.start_at < block.end_at)
                || input
                    .blocks
                    .iter()
                    .any(|b| b.id != block.id && overlap(block, b))
            {
                return Err(AppError::conflict(
                    "New work blocks cannot overlap events or other blocks.",
                ));
            }
            let deadline: (Option<String>, Option<String>) = tx.query_row(
                "SELECT deadline_kind,deadline_value FROM tasks WHERE id=?1",
                [&block.task_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )?;
            if let (Some(kind), Some(value)) = deadline {
                if end > deadline_end(&kind, &value)? {
                    return Err(AppError::validation(
                        "New work blocks must end by the task deadline.",
                    ));
                }
            }
        }
        tx.execute(
            "DELETE FROM plan_blocks WHERE locked=0 AND start_at>?1",
            [timestamp(now)],
        )?;
        for block in input
            .blocks
            .iter()
            .filter(|b| !protected_ids.contains(b.id.as_str()))
        {
            tx.execute("INSERT INTO plan_blocks(id,task_id,start_at,end_at,locked,source,created_at,updated_at) VALUES (?1,?2,?3,?4,0,'scheduler',?5,?5)",params![block.id,block.task_id,block.start_at,block.end_at,input.planned_at])?;
        }
        let revision: i64 =
            tx.query_row("SELECT revision FROM workspace_meta WHERE id=1", [], |r| {
                r.get(0)
            })?;
        let warnings = serde_json::to_string(&input.warnings)
            .map_err(|_| AppError::validation("Planning warnings could not be saved."))?;
        tx.execute("INSERT INTO planning_state(id,planned_at,horizon_end,revision,warnings_json) VALUES (1,?1,?2,?3,?4) ON CONFLICT(id) DO UPDATE SET planned_at=excluded.planned_at,horizon_end=excluded.horizon_end,revision=excluded.revision,warnings_json=excluded.warnings_json",params![input.planned_at,input.horizon_end,revision,warnings])?;
        tx.commit()?;
        Ok(())
    }
}
