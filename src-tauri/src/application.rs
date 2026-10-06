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
        input.name = validate_name(&input.name)?;
        self.repository.save_project(
            &Uuid::new_v4().to_string(),
            &input,
            &timestamp(self.clock.now()),
            true,
        )?;
        self.snapshot()
    }

    pub fn update_project(&mut self, id: &str, mut input: ProjectInput) -> Result<Snapshot> {
        input.name = validate_name(&input.name)?;
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
