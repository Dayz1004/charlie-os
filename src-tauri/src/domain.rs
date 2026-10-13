use chrono::{DateTime, NaiveDate, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: &'static str,
    pub message: String,
}

impl AppError {
    pub fn validation(message: &str) -> Self {
        Self {
            code: "validation",
            message: message.into(),
        }
    }

    pub fn conflict(message: &str) -> Self {
        Self {
            code: "conflict",
            message: message.into(),
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}
impl std::error::Error for AppError {}

impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        // Log codes only: SQL statements/parameters can contain personal data.
        eprintln!("SQLite operation failed: {:?}", error.sqlite_error_code());
        Self {
            code: "database",
            message: "The local database operation failed. Please retry.".into(),
        }
    }
}

pub type Result<T> = std::result::Result<T, AppError>;

macro_rules! string_enum {
    ($name:ident { $($variant:ident => $value:literal),+ $(,)? }) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
        pub enum $name { $(#[serde(rename = $value)] $variant),+ }
        impl $name {
            pub fn as_str(self) -> &'static str {
                match self { $(Self::$variant => $value),+ }
            }
        }
        impl rusqlite::types::FromSql for $name {
            fn column_result(value: rusqlite::types::ValueRef<'_>) -> rusqlite::types::FromSqlResult<Self> {
                match value.as_str()? {
                    $($value => Ok(Self::$variant),)+
                    _ => Err(rusqlite::types::FromSqlError::InvalidType),
                }
            }
        }
    };
}
string_enum!(TaskStatus { Inbox => "inbox", Todo => "todo", InProgress => "in_progress", Blocked => "blocked", Done => "done", Cancelled => "cancelled" });
string_enum!(ProjectStatus { Active => "active", Paused => "paused", Completed => "completed", Archived => "archived" });
string_enum!(Priority { Low => "low", Normal => "normal", High => "high" });

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Deadline {
    Date { value: String },
    Instant { value: String },
}

impl Deadline {
    pub fn normalize(&mut self) -> Result<()> {
        match self {
            Self::Date { value } => {
                let date = NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| {
                    AppError::validation("Deadline must be a valid YYYY-MM-DD date.")
                })?;
                if date.format("%Y-%m-%d").to_string() != *value
                    || !(1..=9998).contains(&date.year())
                {
                    return Err(AppError::validation(
                        "Deadline must be a valid YYYY-MM-DD date in years 0001–9998.",
                    ));
                }
            }
            Self::Instant { value } => {
                let instant = DateTime::parse_from_rfc3339(value)
                    .map_err(|_| {
                        AppError::validation("A timed deadline must include a UTC offset.")
                    })?
                    .with_timezone(&Utc);
                if !(1..=9998).contains(&instant.year()) {
                    return Err(AppError::validation(
                        "Timed deadlines must use years 0001–9998.",
                    ));
                }
                *value = timestamp(instant);
            }
        }
        Ok(())
    }

    pub fn columns(&self) -> (&str, &str) {
        match self {
            Self::Date { value } => ("date", value),
            Self::Instant { value } => ("instant", value),
        }
    }
}
use chrono::Datelike;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub title: String,
    pub description: Option<String>,
    pub project_id: Option<String>,
    pub status: TaskStatus,
    pub priority: Option<Priority>,
    pub deadline: Option<Deadline>,
    pub estimated_minutes: Option<i64>,
    #[serde(default = "default_splittable")]
    pub splittable: bool,
    #[serde(default = "default_minimum_block")]
    pub minimum_useful_block_minutes: i64,
}

fn default_splittable() -> bool {
    true
}
fn default_minimum_block() -> i64 {
    25
}

impl TaskInput {
    pub fn validate(&mut self) -> Result<()> {
        self.title = validate_name(&self.title)?;
        if !(1..=90).contains(&self.minimum_useful_block_minutes) {
            return Err(AppError::validation(
                "Minimum useful block must be 1–90 minutes.",
            ));
        }
        if self
            .estimated_minutes
            .is_some_and(|n| !(1..=525600).contains(&n))
        {
            return Err(AppError::validation(
                "Estimate must be a whole number between 1 and 525600 minutes.",
            ));
        }
        if let Some(deadline) = &mut self.deadline {
            deadline.normalize()?;
        }
        Ok(())
    }
}

pub fn validate_name(value: &str) -> Result<String> {
    let name = value.trim();
    if name.is_empty() || name.chars().count() > 200 {
        return Err(AppError::validation(
            "Name/title must contain 1–200 characters.",
        ));
    }
    Ok(name.into())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub project_id: Option<String>,
    pub status: TaskStatus,
    pub priority: Option<Priority>,
    pub deadline: Option<Deadline>,
    pub estimated_minutes: Option<i64>,
    pub actual_minutes: f64,
    pub splittable: bool,
    pub minimum_useful_block_minutes: i64,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInput {
    pub name: String,
    pub description: Option<String>,
    pub status: ProjectStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: ProjectStatus,
    pub created_at: String,
    pub updated_at: String,
    pub archived_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeEntry {
    pub id: String,
    pub task_id: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_minutes: Option<f64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDependency {
    pub task_id: String,
    pub depends_on_task_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub projects: Vec<Project>,
    pub tasks: Vec<Task>,
    pub time_entries: Vec<TimeEntry>,
    pub dependencies: Vec<TaskDependency>,
    pub events: Vec<crate::calendar::CalendarEvent>,
    pub availability: Vec<crate::calendar::Availability>,
    pub plan_blocks: Vec<crate::calendar::PlanBlock>,
    pub revision: i64,
    pub planning_state: Option<crate::calendar::PlanningState>,
}

pub trait Clock: Send {
    fn now(&self) -> DateTime<Utc>;
}
pub struct SystemClock;
impl Clock for SystemClock {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }
}

pub fn timestamp(now: DateTime<Utc>) -> String {
    now.to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub fn elapsed_millis(start: &str, now: DateTime<Utc>) -> Result<i64> {
    let start = DateTime::parse_from_rfc3339(start)
        .map_err(|_| AppError::validation("Stored timer timestamp is invalid."))?;
    let millis = now.signed_duration_since(start).num_milliseconds();
    if millis < 0 {
        return Err(AppError::conflict(
            "The clock is earlier than the timer start. Correct your system clock and retry.",
        ));
    }
    Ok(millis)
}
