use crate::calendar::{AvailabilityInput, EventInput, ScheduleInput};
use crate::{domain::*, repository::SqliteRepository};
use uuid::Uuid;

pub struct TaskService<C: Clock> {
    repository: SqliteRepository,
    clock: C,
}

impl<C: Clock> TaskService<C> {
    pub fn new(repository: SqliteRepository, clock: C) -> Self {
        Self { repository, clock }
    }
    pub fn snapshot(&mut self) -> Result<Snapshot> {
        self.repository.snapshot()
    }
    pub fn save_event(&mut self, id: Option<&str>, mut input: EventInput) -> Result<Snapshot> {
        input.validate()?;
        self.repository.save_event(
            id.unwrap_or(&Uuid::new_v4().to_string()),
            &input,
            &timestamp(self.clock.now()),
            id.is_none(),
        )?;
        self.snapshot()
    }
    pub fn delete_event(&mut self, id: &str) -> Result<Snapshot> {
        self.repository.delete_event(id)?;
        self.snapshot()
    }
    pub fn replace_availability(&mut self, input: &[AvailabilityInput]) -> Result<Snapshot> {
        self.repository.replace_availability(input)?;
        self.snapshot()
    }
    pub fn replace_schedule(&mut self, input: &ScheduleInput) -> Result<Snapshot> {
        self.repository.replace_schedule(input, self.clock.now())?;
        self.snapshot()
    }
    pub fn set_block_locked(&mut self, id: &str, locked: bool) -> Result<Snapshot> {
        self.repository
            .set_block_locked(id, locked, self.clock.now())?;
        self.snapshot()
    }

    pub fn create_task(&mut self, mut input: TaskInput) -> Result<Snapshot> {
        input.validate()?;
        self.repository.save_task(
            &Uuid::new_v4().to_string(),
            &input,
            &timestamp(self.clock.now()),
            true,
        )?;
        self.snapshot()
    }

    pub fn update_task(&mut self, id: &str, mut input: TaskInput) -> Result<Snapshot> {
        input.validate()?;
        self.repository
            .save_task(id, &input, &timestamp(self.clock.now()), false)?;
        self.snapshot()
    }

    pub fn create_project(&mut self, mut input: ProjectInput) -> Result<Snapshot> {
        input.validate()?;
        self.repository.save_project(
            &Uuid::new_v4().to_string(),
            &input,
            &timestamp(self.clock.now()),
            true,
        )?;
        self.snapshot()
    }

    pub fn update_project(&mut self, id: &str, mut input: ProjectInput) -> Result<Snapshot> {
        input.validate()?;
        self.repository
            .save_project(id, &input, &timestamp(self.clock.now()), false)?;
        self.snapshot()
    }

    pub fn start_task(&mut self, id: &str) -> Result<Snapshot> {
        self.repository.start_task(
            id,
            &Uuid::new_v4().to_string(),
            &timestamp(self.clock.now()),
        )?;
        self.snapshot()
    }

    pub fn save_preferences(&mut self, input: &Preferences) -> Result<Snapshot> {
        input.validate()?;
        self.repository.save_preferences(input)?;
        self.snapshot()
    }

    pub fn stop_task(&mut self, id: &str) -> Result<Snapshot> {
        self.repository.finish_task(id, self.clock.now(), false)?;
        self.snapshot()
    }

    pub fn complete_task(&mut self, id: &str) -> Result<Snapshot> {
        self.repository.finish_task(id, self.clock.now(), true)?;
        self.snapshot()
    }

    pub fn set_dependencies(&mut self, id: &str, ids: &[String]) -> Result<Snapshot> {
        self.repository.set_dependencies(id, ids)?;
        self.snapshot()
    }
}
