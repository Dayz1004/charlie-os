// Opt-in, debug-only fictitious workspace for desktop UX verification.
use crate::{
    application::TaskService,
    calendar::{AvailabilityInput, EventInput},
    domain::*,
};
use chrono::{DateTime, Days, TimeZone, Utc};
use chrono_tz::America::Santiago;

pub fn populate(service: &mut TaskService<SystemClock>, now: DateTime<Utc>) -> Result<()> {
    let snapshot = service.snapshot()?;
    if !snapshot.tasks.is_empty()
        || !snapshot.projects.is_empty()
        || !snapshot.events.is_empty()
        || !snapshot.availability.is_empty()
    {
        return Ok(());
    }
    let today = now.with_timezone(&Santiago).date_naive();
    let tomorrow = today.checked_add_days(Days::new(1)).unwrap();
    let mut ids = Vec::new();
    for (name, color) in [
        ("Compiladores", "#638ac1"),
        ("Termodinámica", "#c18b54"),
        ("Personal", "#6d8c80"),
    ] {
        let snapshot = service.create_project(ProjectInput {
            name: name.into(),
            description: Some("Proyecto ficticio para revisión de UX".into()),
            status: ProjectStatus::Active,
            color: color.into(),
        })?;
        ids.push(
            snapshot
                .projects
                .iter()
                .find(|p| p.name == name)
                .unwrap()
                .id
                .clone(),
        );
    }
    for (title, project, estimate, deadline, status) in [
        (
            "Implementar análisis de tipos",
            0,
            240,
            Some(tomorrow),
            TaskStatus::Todo,
        ),
        (
            "Preparar entrega de Compiladores",
            0,
            900,
            Some(tomorrow),
            TaskStatus::Todo,
        ),
        (
            "Resolver guía de energía",
            1,
            90,
            Some(tomorrow),
            TaskStatus::Todo,
        ),
        (
            "Revisar informe del laboratorio",
            1,
            60,
            Some(today),
            TaskStatus::Blocked,
        ),
        (
            "Organizar lecturas de la semana",
            2,
            30,
            None,
            TaskStatus::Todo,
        ),
        (
            "Preparar preguntas para la reunión",
            0,
            25,
            Some(today),
            TaskStatus::Todo,
        ),
    ] {
        service.create_task(TaskInput {
            title: title.into(),
            description: None,
            project_id: Some(ids[project].clone()),
            status,
            priority: None,
            deadline: deadline.map(|d| Deadline::Date {
                value: d.to_string(),
            }),
            estimated_minutes: Some(estimate),
            splittable: true,
            minimum_useful_block_minutes: 25,
        })?;
    }
    service.replace_availability(
        &(1..=7)
            .map(|weekday| AvailabilityInput {
                weekday,
                start_local: "09:00".into(),
                end_local: "20:00".into(),
                enabled: weekday <= 5,
            })
            .collect::<Vec<_>>(),
    )?;
    for (title, date, hour, duration, project) in [
        ("Reunión de proyecto", today, 18, 1, 0),
        ("Clase de Termodinámica", tomorrow, 11, 2, 1),
    ] {
        let start = Santiago
            .from_local_datetime(&date.and_hms_opt(hour, 0, 0).unwrap())
            .single()
            .unwrap()
            .with_timezone(&Utc);
        service.save_event(
            None,
            EventInput {
                title: title.into(),
                start_at: timestamp(start),
                end_at: timestamp(start + chrono::Duration::hours(duration)),
                project_id: Some(ids[project].clone()),
                location: Some("Sala de estudio · demo".into()),
                notes: None,
            },
        )?;
    }
    Ok(())
}
