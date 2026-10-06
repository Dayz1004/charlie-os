use crate::{application::TaskService, domain::*};
use std::sync::Mutex;
use tauri::State;

pub type AppState = Mutex<TaskService<SystemClock>>;

fn service(state: &AppState) -> Result<std::sync::MutexGuard<'_, TaskService<SystemClock>>> {
    state.lock().map_err(|_| {
        AppError::conflict("The application state is unavailable. Restart CHARLIE OS.")
    })
}

#[tauri::command]
pub fn read_workspace(state: State<'_, AppState>) -> Result<Snapshot> {
    service(&state)?.snapshot()
}
#[tauri::command]
pub fn create_task(state: State<'_, AppState>, input: TaskInput) -> Result<Snapshot> {
    service(&state)?.create_task(input)
}
#[tauri::command]
pub fn update_task(state: State<'_, AppState>, id: String, input: TaskInput) -> Result<Snapshot> {
    service(&state)?.update_task(&id, input)
}
#[tauri::command]
pub fn create_project(state: State<'_, AppState>, input: ProjectInput) -> Result<Snapshot> {
    service(&state)?.create_project(input)
}
#[tauri::command]
pub fn update_project(
    state: State<'_, AppState>,
    id: String,
    input: ProjectInput,
) -> Result<Snapshot> {
    service(&state)?.update_project(&id, input)
}
#[tauri::command]
pub fn start_task(state: State<'_, AppState>, id: String) -> Result<Snapshot> {
    service(&state)?.start_task(&id)
}
#[tauri::command]
pub fn stop_task(state: State<'_, AppState>, id: String) -> Result<Snapshot> {
    service(&state)?.stop_task(&id)
}
#[tauri::command]
pub fn complete_task(state: State<'_, AppState>, id: String) -> Result<Snapshot> {
    service(&state)?.complete_task(&id)
}
#[tauri::command]
pub fn set_task_dependencies(
    state: State<'_, AppState>,
    id: String,
    prerequisite_ids: Vec<String>,
) -> Result<Snapshot> {
    service(&state)?.set_dependencies(&id, &prerequisite_ids)
}
