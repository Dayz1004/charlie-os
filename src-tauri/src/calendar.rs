use crate::domain::{timestamp, validate_name, AppError, Result};
use chrono::{DateTime, Datelike, NaiveTime, Timelike, Utc};
use serde::{Deserialize, Serialize};

pub fn parse_instant(value: &str) -> Result<DateTime<Utc>> {
    let time = DateTime::parse_from_rfc3339(value)
        .map_err(|_| AppError::validation("Use an absolute timestamp with a UTC offset."))?
        .with_timezone(&Utc);
    if !(1..=9998).contains(&time.year()) || time.nanosecond() >= 1_000_000_000 {
        return Err(AppError::validation(
            "Use a supported timestamp in years 0001–9998 without leap seconds.",
        ));
    }
    Ok(time)
}
pub fn normalize_range(start: &mut String, end: &mut String) -> Result<()> {
    let a = parse_instant(start)?;
    let b = parse_instant(end)?;
    if b <= a {
        return Err(AppError::validation("End must be later than start."));
    }
    *start = timestamp(a);
    *end = timestamp(b);
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventInput {
    pub title: String,
    pub start_at: String,
    pub end_at: String,
    pub project_id: Option<String>,
    pub location: Option<String>,
    pub notes: Option<String>,
}
impl EventInput {
    pub fn validate(&mut self) -> Result<()> {
        self.title = validate_name(&self.title)?;
        normalize_range(&mut self.start_at, &mut self.end_at)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub start_at: String,
    pub end_at: String,
    pub project_id: Option<String>,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailabilityInput {
    pub weekday: i64,
    pub start_local: String,
    pub end_local: String,
    pub enabled: bool,
}
impl AvailabilityInput {
    pub fn validate(&self) -> Result<()> {
        if !(1..=7).contains(&self.weekday) {
            return Err(AppError::validation(
                "Weekday must be Monday (1) through Sunday (7).",
            ));
        }
        let a = local_time(&self.start_local)?;
        let b = local_time(&self.end_local)?;
        if b <= a {
            return Err(AppError::validation(
                "Availability must end after it starts on the same local day.",
            ));
        }
        Ok(())
    }
}
pub fn local_time(value: &str) -> Result<NaiveTime> {
    let time = NaiveTime::parse_from_str(value, "%H:%M")
        .map_err(|_| AppError::validation("Availability times must be HH:mm."))?;
    if time.format("%H:%M").to_string() != value {
        return Err(AppError::validation("Availability times must be HH:mm."));
    }
    Ok(time)
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Availability {
    pub id: String,
    pub weekday: i64,
    pub start_local: String,
    pub end_local: String,
    pub enabled: bool,
    pub time_zone: String,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanBlock {
    pub id: String,
    pub task_id: String,
    pub start_at: String,
    pub end_at: String,
    pub locked: bool,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanningWarning {
    pub code: String,
    pub message: String,
    pub task_id: Option<String>,
    pub at: Option<String>,
    pub required_minutes: Option<f64>,
    pub capacity_minutes: Option<f64>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanningState {
    pub planned_at: String,
    pub horizon_end: String,
    pub revision: i64,
    pub warnings: Vec<PlanningWarning>,
}
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleInput {
    pub expected_revision: i64,
    pub planned_at: String,
    pub horizon_end: String,
    pub blocks: Vec<PlanBlock>,
    pub warnings: Vec<PlanningWarning>,
}
