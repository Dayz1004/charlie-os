pub mod application;
pub mod calendar;
mod commands;
pub mod database;
pub mod domain;
pub mod repository;
mod schedule_repository;
#[cfg(debug_assertions)]
mod seed;

use application::TaskService;
use domain::SystemClock;
use repository::SqliteRepository;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let directory = app.path().app_local_data_dir()?;
            // Debug-only override keeps QA/seed data out of the personal database.
            #[cfg(debug_assertions)]
            let path = std::env::var_os("CHARLIE_DB_PATH")
                .map(std::path::PathBuf::from)
                .unwrap_or_else(|| directory.join("charlie.sqlite3"));
            #[cfg(not(debug_assertions))]
            let path = directory.join("charlie.sqlite3");
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let connection = database::open(&path)?;
            let service = TaskService::new(SqliteRepository::new(connection), SystemClock);
            #[cfg(debug_assertions)]
            let mut service = service;
            #[cfg(debug_assertions)]
            if std::env::var("CHARLIE_SEED").as_deref() == Ok("1") {
                seed::populate(&mut service, chrono::Utc::now())?;
            }
            app.manage(Mutex::new(service));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_workspace,
            commands::save_preferences,
            commands::create_task,
            commands::update_task,
            commands::create_project,
            commands::update_project,
            commands::start_task,
            commands::stop_task,
            commands::complete_task,
            commands::set_task_dependencies,
            commands::save_event,
            commands::delete_event,
            commands::replace_availability,
            commands::replace_schedule,
            commands::set_block_locked,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CHARLIE OS");
}
