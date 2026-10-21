# CHARLIE OS

> Estado de implementación: este documento conserva la visión y el roadmap originales, que incluyen funciones futuras. El [README](../README.md) resume las capacidades actuales; los registros [1](MILESTONE_1.md), [2](MILESTONE_2.md) y [3](MILESTONE_3.md) documentan las decisiones implementadas. La planificación determinista, disponibilidad y bloques de trabajo ya existen; IA, lenguaje natural e integraciones externas siguen pendientes. La captura rápida reemplaza el Inbox independiente y el estado frontend usa React, sin Zustand.


## 1. Visión

**CHARLIE OS** es un asistente personal inteligente de gestión de tiempo, tareas y proyectos.

Está diseñado inicialmente para un único usuario y debe funcionar como una capa inteligente sobre su vida académica, laboral y personal.

El objetivo final no es construir simplemente un calendario o una lista de tareas.

El objetivo es que el usuario pueda abrir su computador y preguntarse:

> ¿Qué debería hacer ahora?

Y que CHARLIE tenga suficiente contexto estructurado para responder correctamente.

A largo plazo, el sistema debe conocer:

- tareas pendientes;
- deadlines;
- eventos y compromisos;
- proyectos activos;
- estimaciones de duración;
- historial de tiempo real utilizado;
- dependencias entre tareas;
- disponibilidad horaria;
- carga futura;
- prioridades;
- información proveniente de Calendar, Gmail y Drive;
- preferencias y patrones personales del usuario.

El sistema debe poder:

- capturar información rápidamente;
- detectar qué requiere atención;
- priorizar trabajo;
- construir planes diarios;
- advertir semanas imposibles;
- replanificar cuando cambien las circunstancias;
- aprender progresivamente de las estimaciones reales del usuario;
- permitir interacción mediante lenguaje natural.

---

# 2. Filosofía del producto

CHARLIE debe sentirse como un **asistente personal**, no como una herramienta administrativa.

La interacción ideal es:

> “Charlie, tengo dos horas antes de salir. ¿Qué hago?”

o:

> “El jueves tengo que entregar el informe de termo. Calculo que me faltan unas tres horas.”

o:

> “Hoy no quiero tocar Compiladores. Reorganízame.”

El usuario no debería necesitar decidir manualmente si algo pertenece a:

- tareas;
- calendario;
- proyectos;
- recordatorios;
- notas;
- planificación.

CHARLIE debe encargarse de estructurar esa información.

---

# 3. Principios fundamentales

## 3.1 Una única fuente de verdad

La información importante debe almacenarse estructuradamente.

Los deadlines nunca deben existir únicamente:

- en un prompt;
- en memoria de un modelo;
- en una conversación;
- dentro de texto libre.

Debe existir una fuente de datos persistente y consultable.

---

## 3.2 Local-first

La información principal de CHARLIE debe vivir localmente.

Para la primera versión:

- SQLite será la base de datos principal;
- la aplicación debe poder funcionar sin conexión;
- los datos personales no deben requerir un servidor externo propio.

Las futuras integraciones pueden sincronizar información externa, pero SQLite seguirá siendo el modelo interno de CHARLIE.

---

## 3.3 La IA no es la base de datos

Los modelos de IA sirven para:

- interpretar lenguaje natural;
- razonar;
- priorizar;
- explicar decisiones;
- detectar conflictos;
- generar planes;
- replanificar.

No deben ser responsables de recordar el estado del sistema.

El estado debe provenir de datos estructurados.

---

## 3.4 El usuario siempre tiene control

Todo lo que CHARLIE haga debe poder:

- inspeccionarse;
- editarse;
- corregirse;
- deshacerse cuando corresponda.

No se debe ocultar el razonamiento operativo detrás de cambios importantes.

---

## 3.5 Automatización progresiva

No intentar integrar toda la vida digital del usuario desde el primer release.

Orden deseado:

1. datos locales;
2. tareas;
3. proyectos;
4. eventos;
5. planificación;
6. captura natural;
7. Calendar;
8. IA;
9. Gmail;
10. Drive;
11. automatizaciones más avanzadas.

---

# 4. Stack técnico

Stack inicial recomendado:

### Desktop
- **Tauri**

### Frontend
- **React**
- **TypeScript**
- **Vite**

### Persistencia
- **SQLite**

### Backend local
- Rust/Tauri commands

### Estado frontend
Elegir una solución simple y mantenible.

Preferencia:

- Zustand

Evitar Redux salvo que aparezca una necesidad real.

### Styling

Usar una solución moderna y consistente.

Preferencia:

- Tailwind CSS

Se permite añadir una pequeña librería de componentes si reduce significativamente trabajo repetitivo.

No construir una dependencia excesiva de un framework visual cerrado.

### Package manager

Preferencia:

- pnpm

---

# 5. Arquitectura general

La aplicación debe separar claramente:

```text
UI
│
├── Today
├── Tasks
├── Projects
├── Calendar
├── Inbox
└── Charlie
     │
     ▼
Application Layer
│
├── Task Service
├── Project Service
├── Calendar Service
├── Planning Engine
├── Priority Engine
└── AI Orchestrator
     │
     ▼
Repository Layer
│
└── SQLite
```

Las integraciones externas futuras deben entrar mediante adapters:

```text
Google Calendar
      │
      ▼
Calendar Adapter
      │
      ▼
Internal Event Model
```

Lo mismo debe aplicar para Gmail, Drive u otros proveedores.

El dominio interno no debe depender directamente de estructuras de Google.

---

# 6. Entidades principales

## 6.1 Project

Representa una línea de trabajo continua.

Ejemplos:

- CC5116 Compiladores
- Taller de Videojuegos
- Termodinámica
- Ayudantía Lenguajes de Programación
- Práctica profesional
- Boxeo

Campos iniciales:

```ts
Project {
  id
  name
  description?
  status
  createdAt
  updatedAt
  archivedAt?
}
```

Estados:

```text
active
paused
completed
archived
```

---

# 6.2 Task

Entidad central del sistema.

Campos sugeridos:

```ts
Task {
  id
  title
  description?

  projectId?

  status
  priority?

  deadline?
  scheduledStart?
  scheduledEnd?

  estimatedMinutes?
  actualMinutes?

  energyLevel?
  minimumUsefulBlockMinutes?

  splittable

  createdAt
  updatedAt
  completedAt?
}
```

Estados iniciales:

```text
inbox
todo
in_progress
blocked
done
cancelled
```

`priority` NO debe ser obligatoria.

En el futuro CHARLIE puede calcular una prioridad dinámica independientemente de una prioridad manual.

---

# 6.3 Event

Representa compromisos con horario fijo.

```ts
Event {
  id
  title

  startAt
  endAt

  projectId?

  location?
  notes?

  source
  externalId?

  createdAt
  updatedAt
}
```

Fuentes posibles:

```text
local
google_calendar
```

---

# 6.4 TimeEntry

Debe existir desde temprano aunque la UI completa llegue después.

Sirve para comparar:

> tiempo estimado vs tiempo real.

```ts
TimeEntry {
  id
  taskId

  startedAt
  endedAt?

  durationMinutes?

  createdAt
}
```

---

# 6.5 TaskDependency

Preparar el modelo para dependencias.

```ts
TaskDependency {
  taskId
  dependsOnTaskId
}
```

No es necesario construir UI compleja para esto en v0.1.

---

# 7. Motor de planificación

Una decisión arquitectónica importante:

**la planificación NO debe depender exclusivamente de un LLM.**

Debe existir un Planning Engine determinista.

Este motor tendrá acceso a:

- deadlines;
- duración estimada;
- tiempo disponible;
- eventos;
- estado de tareas;
- proyectos;
- prioridades;
- dependencias.

Debe poder producir candidatos razonables incluso sin IA.

---

# 8. Priority Engine

Para v0.1 implementar una primera heurística sencilla y explicable.

No buscar una fórmula perfecta.

Considerar al menos:

### Urgencia

Cuánto falta para el deadline.

### Duración restante

Una tarea grande cercana al deadline debe aumentar su riesgo.

### Prioridad manual

Si existe.

### Estado

Tareas bloqueadas no deben ser recomendadas.

### Deadline ausente

Una tarea sin deadline no debe desaparecer del sistema.

---

## 8.1 Concepto de riesgo

Preparar una función similar a:

```ts
getTaskRisk(task, context)
```

Puede producir:

```text
low
medium
high
critical
```

La implementación inicial puede ser heurística.

Debe ser:

- determinista;
- testeable;
- explicable.

---

# 9. v0.1 — TODAY

La primera versión funcional debe concentrarse en una sola experiencia excelente:

# “¿Qué tengo que hacer hoy?”

---

# 10. Pantalla principal

Al abrir la aplicación se debe mostrar `Today`.

Conceptualmente:

```text
┌───────────────────────────────────────────────┐
│ CHARLIE                                       │
│                                               │
│ Buenos días.                                  │
│ Lunes 5 de octubre                            │
│                                               │
│ ⚠ 2 tareas requieren atención                │
│                                               │
│ TODAY                                         │
│                                               │
│ 10:30   Clase                                 │
│ 13:30   Trabajo Compiladores       90 min     │
│ 16:50   Boxeo                                 │
│ 18:00   Reunión Compiladores                  │
│                                               │
│ NEXT                                          │
│                                               │
│ → Implementar typechecking                    │
│   ~1h 30min · deadline en 3 días              │
│                                               │
│ [ Empezar ]        [ Replanificar ]           │
│                                               │
│ ────────────────────────────────────────────  │
│ Ask Charlie...                                │
└───────────────────────────────────────────────┘
```

No copiar literalmente este diseño.

Es una referencia conceptual.

La interfaz debe sentirse:

- limpia;
- moderna;
- minimalista;
- rápida;
- personal.

Evitar estética de dashboard empresarial.

---

# 11. Navegación v0.1

Sidebar inicial:

```text
Today
Inbox
Tasks
Projects
Calendar
```

En la parte inferior:

```text
Settings
```

No construir funcionalidades falsas.

Si una sección todavía no está implementada completamente, debe existir solo si aporta valor real.

---

# 12. Today

Debe mostrar:

## Fecha actual

Con saludo adecuado según horario.

Ejemplo:

```text
Buenos días.         
```

---

## Próximos eventos

Ordenados cronológicamente.

---

## Alertas

Ejemplos:

```text
2 deadlines requieren atención.
```

```text
Una tarea parece difícil de completar antes de su deadline.
```

---

## Next Task

El Planning Engine debe recomendar una tarea.

Mostrar:

- título;
- proyecto;
- duración estimada restante;
- deadline;
- riesgo.

---

## Acciones

### Start

Inicia seguimiento de tiempo para la tarea.

Crea un `TimeEntry`.

Debe existir una sola tarea activa simultáneamente.

---

### Complete

Marca tarea como completada.

---

### Replan

En v0.1 puede simplemente recalcular la recomendación usando el motor determinista.

Más adelante será una interacción más compleja con IA.

---

# 13. Inbox

Debe permitir capturar algo rápidamente.

v0.1:

```text
[ Tengo que hacer... ]
```

Crear una tarea con:

```text
status = inbox
```

Sin obligar al usuario a completar diez campos.

Después puede editar:

- proyecto;
- deadline;
- estimación;
- prioridad.

La velocidad de captura es más importante que la precisión inicial.

---

# 14. Tasks

Debe permitir:

- crear tareas;
- editar tareas;
- completar tareas;
- eliminar/cancelar tareas;
- filtrar por estado;
- filtrar por proyecto.

Mostrar al menos:

```text
Título
Proyecto
Deadline
Estimación
Estado
Riesgo
```

---

# 15. Projects

Vista simple.

Debe poder:

- crear proyecto;
- editar proyecto;
- archivar proyecto;
- ver tareas relacionadas.

No desarrollar todavía gestión avanzada de proyectos.

---

# 16. Calendar

En v0.1 los eventos son locales.

Debe existir como mínimo una vista útil de próximos eventos.

Si construir inmediatamente una vista calendario mensual/semanal completa añade demasiado trabajo, preferir una buena agenda cronológica antes que una mala implementación de calendario.

---

# 17. Ask Charlie

Debe existir visualmente desde v0.1 porque representa una parte central de la experiencia futura.

Sin embargo:

**no integrar todavía un proveedor de IA únicamente para poder decir que existe IA.**

En v0.1 puede:

- permanecer como interfaz preparada;
- manejar un conjunto mínimo de comandos locales;
- o marcarse claramente como próxima funcionalidad.

No simular respuestas inteligentes falsas.

La arquitectura debe quedar preparada para conectar posteriormente un `AIProvider`.

---

# 18. AI Orchestrator futuro

Diseñar una interfaz conceptual similar a:

```ts
interface AIProvider {
  complete(request: AIRequest): Promise<AIResponse>
}
```

No acoplar el dominio directamente a OpenAI.

En el futuro deben poder existir adapters:

```text
OpenAIProvider
LocalModelProvider
MockAIProvider
```

El proveedor concreto se decidirá después.

---

# 19. Captura en lenguaje natural

Una futura versión debe transformar:

> “El viernes tengo que entregar el informe de termo y me quedan unas tres horas.”

en algo similar a:

```json
{
  "title": "Terminar informe de Termodinámica",
  "deadline": "...",
  "estimatedMinutes": 180,
  "project": "Termodinámica"
}
```

Importante:

antes de persistir operaciones ambiguas o destructivas, CHARLIE debe poder mostrar lo interpretado.

---

# 20. Integración futura con Google Calendar

No implementar todavía OAuth en el primer vertical slice.

Preparar arquitectura.

Objetivos futuros:

- importar eventos;
- mantener `externalId`;
- detectar actualizaciones;
- distinguir eventos locales y externos;
- evitar duplicados.

Google Calendar será eventualmente la principal fuente externa de compromisos temporales.

---

# 21. Gmail futuro

Objetivo:

detectar información accionable.

Ejemplos:

- entrevistas;
- reuniones;
- deadlines;
- respuestas pendientes;
- cambios de horario.

CHARLIE no debe convertir automáticamente cualquier correo en una tarea.

Debe existir una capa de interpretación.

---

# 22. Google Drive futuro

Drive aportará contexto documental:

- programas de cursos;
- enunciados;
- documentos;
- planificaciones;
- material de proyectos.

La información derivada relevante debe convertirse en datos estructurados cuando corresponda.

---

# 23. Diseño visual

Queremos una identidad propia.

Conceptos:

```text
calm
focused
intelligent
personal
premium
minimal
```

NO queremos:

```text
corporate SaaS dashboard
Notion clone
Google Calendar clone
task manager genérico
```

Inspiración conceptual:

- interfaces de productividad modernas;
- command centers;
- asistentes personales;
- HUD sutil estilo ciencia ficción.

Pero evitar una interfaz exageradamente “Iron Man”.

Debe poder utilizarse varias horas diariamente sin cansar.

---

# 24. Dark mode

Dark mode debe considerarse desde el inicio.

La arquitectura visual debe soportar:

```text
dark
light
system
```

No es obligatorio tener las tres opciones completamente terminadas en el primer commit.

---

# 25. Seguridad

Principios:

- secretos nunca dentro del repositorio;
- tokens nunca almacenados en texto plano si posteriormente se agregan integraciones;
- `.env` debe quedar fuera de Git;
- futuras credenciales deben almacenarse usando mecanismos seguros del sistema operativo cuando sea razonable;
- ninguna integración externa debe recibir más información de la necesaria.

---

# 26. Persistencia

SQLite debe usar migraciones.

No crear tablas manualmente en runtime sin sistema de migración.

La aplicación debe poder evolucionar de esquema sin destruir datos existentes.

---

# 27. Testing

Prioridad alta para lógica de dominio.

Especialmente:

```text
Priority Engine
Planning Engine
deadline calculations
risk calculations
time calculations
```

La UI no necesita cobertura absurda inicialmente.

Preferir:

- unit tests sólidos del dominio;
- algunos integration tests útiles.

---

# 28. Seed data

Durante desarrollo, incluir un mecanismo de seed opcional.

Ejemplo de proyectos:

```text
Compiladores
Videojuegos
Termodinámica
Ayudantía LP
Práctica
Personal
```

Y tareas/eventos ficticios.

El seed debe poder activarse únicamente en desarrollo.

---

# 29. Logging

Agregar logging básico desde temprano.

Debe ayudar a diagnosticar:

- errores SQLite;
- errores de comandos Tauri;
- planificación;
- futuras integraciones.

No registrar información sensible innecesariamente.

---

# 30. Manejo de fechas

Muy importante.

Las fechas deben almacenarse de forma consistente.

Zona horaria principal inicial:

```text
America/Santiago
```

No asumir UTC visualmente.

Separar correctamente:

- timestamps absolutos;
- fechas locales;
- deadlines sin horario;
- eventos con horario.

Evitar hacks basados en strings.

---

# 31. No objetivos de v0.1

NO implementar todavía:

- autenticación multiusuario;
- servidor cloud propio;
- colaboración;
- aplicación móvil;
- sincronización entre múltiples PCs;
- Gmail;
- Google Drive;
- OAuth;
- notificaciones push externas;
- reconocimiento de voz;
- modelos locales;
- machine learning de hábitos;
- planificación automática compleja;
- time blocking automático;
- generación automática de calendario;
- agentes autónomos;
- plugins;
- marketplace;
- gamificación.

Preparar arquitectura razonable para crecer, pero no sobrearquitecturar.

---

# 32. Roadmap

## v0.1 — Today

Objetivo:

> CHARLIE conoce mis tareas, proyectos y eventos locales y puede decirme qué debería hacer ahora.

Incluye:

- app Tauri;
- React + TypeScript;
- SQLite;
- Projects CRUD;
- Tasks CRUD;
- Events CRUD básico;
- Inbox;
- Today;
- Planning Engine inicial;
- Priority/Risk Engine;
- seguimiento básico de tiempo;
- persistencia real;
- interfaz pulida.

---

## v0.2 — Natural Inbox

Objetivo:

> Puedo escribir lo que necesito hacer sin llenar formularios.

Incluye:

- parsing mediante IA;
- preview de acciones;
- creación de tareas/eventos desde lenguaje natural.

---

## v0.3 — Calendar

Objetivo:

> CHARLIE conoce automáticamente mis compromisos.

Incluye:

- Google OAuth;
- Google Calendar;
- sincronización;
- conflictos;
- disponibilidad.

---

## v0.4 — Daily Planner

Objetivo:

> CHARLIE puede construir mi día.

Incluye:

- disponibilidad real;
- bloques de trabajo;
- replanificación;
- preferencias personales;
- restricciones.

---

## v0.5 — Gmail

Objetivo:

> CHARLIE detecta tareas y compromisos que llegan por correo.

---

## v0.6 — Drive

Objetivo:

> CHARLIE puede usar documentos personales como contexto.

---

## v0.7 — Proactive Charlie

Incluye:

- brief diario;
- alertas;
- revisiones semanales;
- detección anticipada de sobrecarga;
- notificaciones.

---

## v1.0 — CHARLIE OS

La aplicación debe sentirse como un verdadero asistente personal de gestión.

---

# 33. Definition of Done para v0.1

La versión 0.1 estará completa cuando sea posible:

1. abrir CHARLIE como aplicación de escritorio;
2. crear proyectos;
3. crear tareas;
4. crear eventos;
5. cerrar y volver a abrir la aplicación sin perder información;
6. ver compromisos del día;
7. ver deadlines próximos;
8. identificar tareas en riesgo;
9. recibir una recomendación de qué hacer ahora;
10. iniciar una tarea;
11. registrar cuánto tiempo se trabajó;
12. marcarla como completada;
13. obtener una nueva recomendación;
14. capturar rápidamente una tarea mediante Inbox;
15. editar cualquier dato creado;
16. utilizar la app cómodamente como herramienta real.

---

# 34. Criterio de calidad

No queremos una prueba de concepto descartable.

Cada decisión debe favorecer:

- mantenibilidad;
- claridad;
- testabilidad;
- evolución futura.

Al mismo tiempo:

**evitar sobrearquitectura prematura.**

Si existe una solución simple que mantiene limpio el dominio, elegir la simple.

---

# 35. Instrucciones para Codex

Este documento representa la dirección de producto actual.

Al implementar:

1. inspeccionar primero el entorno y herramientas disponibles;
2. proponer una estructura de proyecto breve;
3. crear el proyecto real;
4. trabajar mediante vertical slices funcionales;
5. ejecutar tests y build frecuentemente;
6. no dejar código esencial como pseudocódigo;
7. no añadir dependencias sin necesidad;
8. mantener separación entre UI, dominio y persistencia;
9. registrar decisiones arquitectónicas importantes;
10. actualizar este documento si una decisión acordada cambia.

Si aparece una decisión menor que no está especificada aquí:

**escoger una opción razonable y continuar.**

No detener el desarrollo por preguntas cosméticas.

Si aparece una decisión que afectaría significativamente:

- arquitectura;
- seguridad;
- modelo de datos;
- compatibilidad futura;
- experiencia central del producto;

detenerse y explicarla antes de comprometerse con una dirección difícil de revertir.

---

# 36. Primera misión

Construir **CHARLIE OS v0.1**.

Primero:

1. inicializar el repositorio;
2. configurar Tauri + React + TypeScript;
3. configurar styling;
4. definir arquitectura de carpetas;
5. configurar SQLite y migraciones;
6. crear entidades iniciales;
7. implementar repositorios;
8. crear shell visual de la aplicación.

Luego implementar el primer vertical slice completo:

```text
Create Task
      ↓
Persist SQLite
      ↓
Read Tasks
      ↓
Planning Engine
      ↓
Today
      ↓
Start Task
      ↓
TimeEntry
      ↓
Complete Task
      ↓
Recalculate Next Task
```

Este flujo debe funcionar de extremo a extremo antes de aumentar significativamente el alcance.

---

# 37. North Star

Cada decisión debería acercarnos a esta experiencia:

```text
Usuario:
Charlie, ¿qué hago ahora?

CHARLIE:
Tienes 1 hora y 40 minutos libres antes de tu próximo compromiso.

Te recomiendo avanzar en la Entrega 3 de Compiladores durante 90 minutos.
Vence en dos días y todavía quedan aproximadamente cuatro horas de trabajo.

Después tendrás diez minutos para cerrar y prepararte para salir.

[Empezar]
[Ver otras opciones]
```

Si CHARLIE puede responder esa pregunta correctamente y actuar sobre la respuesta, estamos construyendo el producto correcto.
