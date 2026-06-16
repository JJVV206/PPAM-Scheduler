# Plan de Evolucion al Flujo Automatizado Gratuito

## Objetivo

Evolucionar el flujo actual descrito en `docs/email-assignment-automation-plan.md` hacia el flujo automatizado gratuito mostrado en el diagrama:

```txt
Preparar semana
-> Censo semanal de suplentes
-> Confirmacion del titular
-> Busqueda de suplente
-> Confirmacion del suplente
-> Alertas al admin solo cuando el sistema no pueda resolver
```

El objetivo es mantener la operacion sin costo extra de proveedores:

- Email como canal principal.
- Notificaciones internas dentro de la app.
- Enlaces seguros con token.
- Cron automatico.
- Logs y timeline.
- UI simple para que el admin gestione excepciones, no trabajo repetitivo.

Este plan excluye por ahora:

- WhatsApp.
- Llamadas automaticas.
- SMS.
- Push notifications de proveedor externo.
- Canales pagados de mensajeria.

La arquitectura debe quedar preparada para agregar canales pagados despues, pero el alcance de este plan debe ejecutarse solo con email y app interna.

## Principios de Producto

La UI del admin debe ser un centro de control operativo.

Reglas:

- El admin no debe mandar invitaciones iniciales manualmente.
- El admin no debe buscar suplentes manualmente salvo excepcion.
- El admin debe ver rapidamente que esta cubierto, que esta pendiente y que requiere atencion.
- El flujo debe ser entendible sin mostrar detalles tecnicos innecesarios.
- Los logs, tokens, cron y errores tecnicos deben existir, pero no deben dominar la UI principal.
- Toda decision automatica debe poder auditarse.

## Diferencia Contra el Plan Actual

El plan actual ya cubre:

- Invitaciones `PRIMARY`.
- Invitaciones `REPLACEMENT`.
- Token seguro para confirmar o rechazar.
- Respuesta por email hacia la app.
- Suplentes automaticos.
- Recordatorios por email.
- Cron automatico.
- Alertas al admin por email.
- Logs y timeline.

Este plan agrega o detalla:

- Censo semanal de suplentes.
- Disponibilidad semanal por dia.
- Horario especifico opcional para suplentes.
- Prioridad de busqueda: horario exacto, dia disponible, disponibilidad general.
- Recordatorios exactos durante la ventana del titular: 12h, 24h, 40h.
- Recordatorios exactos durante la ventana del suplente: 4h, 8h.
- Notificaciones internas dentro de la app cuando no respondan al censo o cuando haya atencion requerida.
- UI admin simplificada alrededor de "Atencion requerida", "Horario semanal" y "Suplentes".

## Modulo 1: Modelo de Datos

Extender el modelo actual para soportar censo semanal de suplentes, disponibilidad capturada por semana y notificaciones internas.

### 1.1. Censo semanal de suplentes

Crear una entidad para representar el censo de disponibilidad de una semana.

Campos sugeridos:

```prisma
enum ReplacementCensusStatus {
  DRAFT
  OPEN
  CLOSED
  CANCELLED
}

model ReplacementCensus {
  id             String                  @id @default(cuid())
  scheduleWeekId String
  status         ReplacementCensusStatus @default(DRAFT)
  sentAt         DateTime?
  closesAt       DateTime
  createdById    String
  metadata       Json?
  createdAt      DateTime                @default(now())
  updatedAt      DateTime                @updatedAt

  scheduleWeek   ScheduleWeek            @relation(fields: [scheduleWeekId], references: [id], onDelete: Cascade)
  createdBy      User                    @relation(fields: [createdById], references: [id])
  responses      ReplacementCensusResponse[]

  @@unique([scheduleWeekId])
  @@index([status, closesAt])
}
```

### 1.2. Respuesta individual al censo

Cada voluntario marcado como suplente debe tener una respuesta al censo semanal.

Campos sugeridos:

```prisma
enum ReplacementCensusResponseStatus {
  PENDING
  SENT
  SUBMITTED
  DECLINED
  EXPIRED
  FAILED
}

model ReplacementCensusResponse {
  id            String                          @id @default(cuid())
  censusId      String
  volunteerId   String
  status        ReplacementCensusResponseStatus @default(PENDING)
  token         String                          @unique
  sentAt        DateTime?
  respondedAt   DateTime?
  expiresAt     DateTime
  emailAttempts Int                             @default(0)
  metadata      Json?
  createdAt     DateTime                        @default(now())
  updatedAt     DateTime                        @updatedAt

  census        ReplacementCensus               @relation(fields: [censusId], references: [id], onDelete: Cascade)
  volunteer     VolunteerProfile                @relation(fields: [volunteerId], references: [id], onDelete: Cascade)
  availability  ReplacementWeeklyAvailability[]

  @@unique([censusId, volunteerId])
  @@index([volunteerId, status])
  @@index([expiresAt, status])
}
```

### 1.3. Disponibilidad semanal capturada por censo

Guardar disponibilidad por fecha. El horario especifico debe ser opcional.

Campos sugeridos:

```prisma
model ReplacementWeeklyAvailability {
  id               String                    @id @default(cuid())
  censusResponseId String
  volunteerId      String
  scheduleWeekId   String
  date             DateTime
  dayOfWeek        DayOfWeek
  timeSlot         TimeSlot?
  available        Boolean                   @default(true)
  notes            String?
  createdAt        DateTime                  @default(now())
  updatedAt        DateTime                  @updatedAt

  censusResponse   ReplacementCensusResponse @relation(fields: [censusResponseId], references: [id], onDelete: Cascade)
  volunteer        VolunteerProfile          @relation(fields: [volunteerId], references: [id], onDelete: Cascade)
  scheduleWeek     ScheduleWeek              @relation(fields: [scheduleWeekId], references: [id], onDelete: Cascade)

  @@unique([censusResponseId, date, timeSlot])
  @@index([scheduleWeekId, date, timeSlot, available])
  @@index([volunteerId, scheduleWeekId])
}
```

Regla importante:

- `timeSlot = null` significa "disponible ese dia en general".
- `timeSlot != null` significa "disponible en ese horario especifico".

### 1.4. Notificaciones internas dentro de la app

`NotificationLog` sirve para auditar envios. Para una UI de notificaciones reales, conviene separar las notificaciones que el usuario debe ver.

Campos sugeridos:

```prisma
enum AppNotificationType {
  CENSUS_PENDING
  ASSIGNMENT_PENDING
  ASSIGNMENT_CONFIRMED
  REPLACEMENT_NEEDED
  ADMIN_ATTENTION_REQUIRED
  EMAIL_FAILED
}

enum AppNotificationPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

model AppNotification {
  id           String                  @id @default(cuid())
  userId       String
  assignmentId String?
  censusId     String?
  type         AppNotificationType
  priority     AppNotificationPriority @default(NORMAL)
  title        String
  body         String
  readAt       DateTime?
  metadata     Json?
  createdAt    DateTime                @default(now())

  user         User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  assignment   Assignment?             @relation(fields: [assignmentId], references: [id], onDelete: SetNull)
  census       ReplacementCensus?       @relation(fields: [censusId], references: [id], onDelete: SetNull)

  @@index([userId, readAt, createdAt])
  @@index([assignmentId, type])
  @@index([censusId, type])
}
```

Resultado esperado:

- El email queda como canal externo principal.
- La app puede mostrar pendientes, alertas y estados sin depender de servicios pagados.
- El admin puede ver "Requiere atencion" sin revisar logs tecnicos.

## Modulo 2: Preparacion de Semana

Cuando el admin crea o duplica una semana, los horarios deben quedar con titulares asignados y listos para automatizacion.

Features:

- Crear o duplicar `ScheduleWeek`.
- Crear asignaciones con titulares ya definidos.
- Permitir que el admin edite titulares antes de iniciar confirmaciones.
- Crear invitaciones `PRIMARY` para titulares.
- Crear o abrir el censo semanal de suplentes.
- Enviar emails iniciales de confirmacion a titulares.
- Enviar email del censo semanal a suplentes.
- Registrar actividad y logs.

Flujo esperado:

```txt
Admin crea o duplica semana
-> Cada horario queda con titular asignado
-> Admin puede editar titulares
-> Sistema envia invitaciones por email
-> Sistema abre censo de suplentes
```

Reglas:

- No enviar duplicados si la semana ya tiene invitaciones activas.
- Si el admin cambia un titular antes del envio, invalidar la invitacion anterior si aplica.
- Si el admin cambia un titular despues del envio, registrar override manual.
- Si se duplica una semana, las nuevas invitaciones deben usar tokens nuevos.
- Las semanas deben seguir el formato lunes a domingo.

## Modulo 3: Censo Semanal de Suplentes

Agregar un flujo de censo para saber que suplentes estan disponibles antes de que ocurra una emergencia.

Features:

- Identificar voluntarios activos con `canServeAsReplacement = true`.
- Crear `ReplacementCensus` por semana.
- Crear `ReplacementCensusResponse` para cada suplente.
- Enviar email semanal con enlace seguro al censo.
- Permitir responder disponibilidad por dia.
- Permitir indicar horarios especificos opcionales.
- Guardar disponibilidad semanal.
- Mostrar a quienes no han respondido.
- Permitir al admin registrar disponibilidad manual si alguien responde fuera de la app.

Pantalla del voluntario:

- Mostrar los 7 dias de la semana.
- Permitir marcar disponible/no disponible por dia.
- Permitir expandir un dia y seleccionar horarios especificos.
- Permitir nota opcional.
- Guardar respuesta sin obligar horario especifico.

Regla de disponibilidad:

```txt
Disponible en horario exacto > Disponible en el dia > Disponibilidad general > Sin disponibilidad confirmada
```

Recordatorios del censo:

- Email inicial al abrir el censo.
- Email recordatorio si no responde.
- Notificacion interna dentro de la app.
- Si no responde, queda como "disponibilidad no confirmada".

No hacer en este alcance:

- WhatsApp para censo.
- Llamadas para censo.
- SMS para censo.
- Push externo para censo.

Resultado esperado:

- El sistema no busca suplentes a ciegas.
- El admin puede ver cuantos suplentes respondieron.
- La busqueda de reemplazo usa disponibilidad real de esa semana.

## Modulo 4: Invitacion y Ventana del Titular

El titular debe recibir invitacion inicial por email con enlace seguro hacia la app.

Features:

- Crear invitacion `PRIMARY`.
- Enviar email inicial.
- Mostrar pantalla de confirmacion por token.
- Permitir confirmar.
- Permitir rechazar.
- Permitir nota opcional.
- Vencer la invitacion si no responde dentro de 48 horas.
- Enviar recordatorios durante la ventana de respuesta.

Ventana base:

```txt
0 h: email inicial
12 h: email recordatorio 1
24 h: email recordatorio 2
40 h: ultimo email
48 h: sin respuesta = buscar suplente
```

Reglas:

- Si confirma, marcar `AssignmentInvitation` como `ACCEPTED`.
- Si confirma, actualizar o crear `AssignmentResponse` como `CONFIRMED`.
- Si confirma, recalcular `Assignment.status`.
- Si rechaza, marcar invitacion como `DECLINED`.
- Si rechaza, actualizar o crear `AssignmentResponse` como `DECLINED`.
- Si no responde, marcar invitacion como `EXPIRED`.
- Si rechaza o expira, marcar asignacion como `NEEDS_REPLACEMENT`.
- No enviar recordatorios a una invitacion ya aceptada o rechazada.
- No duplicar recordatorios.

Regla de proximidad:

Si el turno esta cerca, la ventana debe comprimirse automaticamente.

Settings sugeridos:

```ts
primaryResponseTimeoutHours: 48
primaryReminderOffsetsHours: [12, 24, 40]
urgentPrimaryResponseTimeoutHours: 12
urgentPrimaryReminderOffsetsHours: [4, 8]
urgentThresholdHours: 72
```

## Modulo 5: Busqueda de Suplente

Cuando un titular rechaza o no responde, el sistema debe buscar suplente usando el censo semanal primero.

Funciones sugeridas:

```ts
findReplacementCandidatesForAssignment()
rankReplacementCandidates()
excludeAlreadyAttemptedCandidates()
createReplacementInvitation()
```

Criterios de elegibilidad:

- Voluntario activo.
- Usuario activo.
- `canServeAsReplacement = true`.
- No temporalmente no disponible.
- No tiene excepcion de disponibilidad activa.
- No esta asignado a otro turno en la misma fecha y horario.
- No es el titular que rechazo.
- No fue intentado ya para esa asignacion.

Prioridad de busqueda:

1. Suplente con disponibilidad en el horario exacto.
2. Suplente con disponibilidad en ese dia.
3. Suplente con disponibilidad general o recurrente compatible.
4. Preferencia de area compatible.
5. Mejor historial de confirmacion.
6. Menor cantidad de asignaciones futuras.
7. Orden alfabetico como desempate estable.

Estados esperados:

- `NEEDS_REPLACEMENT` cuando se requiere reemplazo.
- `PENDING_CONFIRMATION` cuando hay suplente invitado.
- `REASSIGNED` cuando el suplente acepta.
- `CANCELLED` si el admin cancela manualmente.

Reglas:

- Si hay candidato, crear invitacion `REPLACEMENT`.
- Si no hay candidato, crear alerta urgente para el admin.
- Si falla el email al suplente, intentar otro candidato si es seguro.
- Registrar todos los intentos en `AssignmentActivity`.
- Registrar envios en `NotificationLog`.

## Modulo 6: Invitacion y Ventana del Suplente

El suplente elegido debe recibir email con enlace seguro hacia la app.

Features:

- Crear invitacion `REPLACEMENT`.
- Enviar email al suplente.
- Mostrar que la invitacion es como suplente.
- Permitir confirmar o rechazar.
- Permitir nota opcional.
- Vencer la invitacion si no responde dentro de 12 horas.
- Enviar recordatorios durante la ventana.
- Si no responde o rechaza, intentar el siguiente candidato.

Ventana base:

```txt
0 h: email inicial
4 h: email recordatorio 1
8 h: ultimo email
12 h: sin respuesta = siguiente suplente
```

Reglas:

- Si acepta, marcar invitacion como `ACCEPTED`.
- Si acepta, crear o actualizar `AssignmentVolunteer`.
- Si acepta, marcar `isReplacement = true`.
- Si acepta, crear o actualizar `AssignmentResponse` como `CONFIRMED`.
- Si acepta, recalcular estado de la asignacion.
- Si rechaza, marcar invitacion como `DECLINED`.
- Si expira, marcar invitacion como `EXPIRED`.
- Si rechaza o expira, intentar siguiente suplente.
- Si ya no hay candidatos, alertar al admin.

Settings sugeridos:

```ts
replacementResponseTimeoutHours: 12
replacementReminderOffsetsHours: [4, 8]
urgentReplacementResponseTimeoutHours: 4
urgentReplacementReminderOffsetsHours: [2]
```

## Modulo 7: Recordatorios del Turno

Los voluntarios confirmados, titulares o suplentes, deben recibir recordatorios del turno segun el tiempo restante.

Cadencia inicial:

- 5 dias antes.
- 1 dia antes.
- Horas antes, por ejemplo 3 horas antes.

Settings sugeridos:

```ts
assignmentReminderTimingDays: [5, 1]
assignmentFinalReminderHours: 3
```

Reglas:

- Enviar recordatorios solo a voluntarios confirmados.
- Si el suplente confirma tarde, enviar solo los recordatorios que todavia apliquen.
- No enviar recordatorios vencidos.
- No enviar recordatorios duplicados.
- Registrar cada recordatorio en `NotificationLog`.
- Registrar actividad `REMINDER_SENT`.
- Crear notificacion interna opcional para el voluntario.

Ejemplo:

```txt
Si el suplente confirma 2 dias antes:
-> no enviar recordatorio de 5 dias
-> enviar recordatorio de 1 dia
-> enviar recordatorio final de horas antes
```

## Modulo 8: Notificaciones Internas Gratuitas

Agregar notificaciones dentro de la app para mejorar visibilidad sin pagar proveedores externos.

Casos para voluntario:

- Censo semanal pendiente.
- Asignacion pendiente de respuesta.
- Asignacion confirmada.
- Recordatorio visible dentro de la app.

Casos para admin:

- Turno sin cobertura.
- No hay suplentes disponibles.
- Email critico fallido.
- Censo con baja respuesta.
- Asignacion requiere intervencion.

Reglas:

- Las notificaciones internas no reemplazan al email.
- Las notificaciones internas deben poder marcarse como leidas.
- La UI debe mostrar contador discreto, no ruido constante.
- Las notificaciones criticas deben aparecer en "Atencion requerida".
- No crear multiples notificaciones iguales para el mismo caso.

## Modulo 9: Motor de Automatizacion

Extender el servicio central para ejecutar el flujo completo.

Archivo sugerido:

```txt
services/assignment-automation.service.ts
```

Funciones sugeridas:

```ts
processAssignmentAutomationRun()
sendPendingPrimaryInvitations()
sendPrimaryResponseReminders()
expireTimedOutPrimaryInvitations()
openWeeklyReplacementCensus()
sendReplacementCensusInvitations()
sendReplacementCensusReminders()
closeExpiredReplacementCensus()
processAssignmentsNeedingReplacement()
inviteNextAvailableReplacement()
sendReplacementResponseReminders()
expireTimedOutReplacementInvitations()
sendDueAssignmentReminders()
createDueAppNotifications()
notifyAdminsForUnresolvedAssignments()
```

Requisitos:

- Idempotente.
- Seguro para ejecutarse cada 30 minutos.
- No duplicar emails.
- No duplicar notificaciones internas.
- Tolerante a fallas parciales.
- Registrar decisiones en `AssignmentActivity`.
- Registrar envios en `NotificationLog`.
- Guardar resumen de ejecucion para observabilidad.

Buenas practicas:

- Usar transacciones para cambios de estado criticos.
- Usar indices por estado y expiracion.
- Procesar por lotes pequenos.
- Evitar loops infinitos de suplentes.
- Registrar `automationRunId` en metadata cuando sea util.
- No mezclar logica de UI con reglas de automatizacion.
- No depender del cliente/browser para tareas criticas.

## Modulo 10: Cron en Vercel

Mantener un endpoint cron protegido para ejecutar el motor.

Ruta sugerida:

```txt
/api/cron/assignment-automation
```

Proteccion:

- Usar `CRON_SECRET`.
- Rechazar requests sin header valido.
- No exponer detalles sensibles en la respuesta.

Ejemplo:

```ts
const authHeader = request.headers.get("authorization");

if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

Config sugerida:

```json
{
  "crons": [
    {
      "path": "/api/cron/assignment-automation",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

El cron debe ejecutar:

- Invitaciones pendientes.
- Recordatorios de titular.
- Expiracion de titular.
- Censo semanal de suplentes.
- Recordatorios de censo.
- Busqueda e invitacion de suplentes.
- Recordatorios de suplente.
- Expiracion de suplente.
- Recordatorios del turno.
- Alertas al admin.

## Modulo 11: UI Admin Simple

La UI del admin debe mostrar control sin ruido innecesario.

Menu recomendado:

```txt
Inicio
Horario semanal
Atencion requerida
Suplentes
Asignaciones
Voluntarios
Configuracion
```

### Inicio

Debe responder:

- Cuantos turnos estan cubiertos.
- Cuantos estan pendientes.
- Cuantos buscan suplente.
- Cuantos requieren atencion.
- Como va el censo de suplentes.
- Que turnos ocurren hoy y en los proximos 2 o 3 dias.
- Si hay emails fallidos, respuestas vencidas o turnos sin cobertura.

Bloques recomendados:

| Bloque | Objetivo |
| --- | --- |
| Cobertura semanal | Mostrar confirmadas, pendientes, buscando suplente y requieren atencion. |
| Requiere atencion | Mostrar solo casos donde el sistema ya no pudo resolver solo. |
| Proximos turnos | Mostrar turnos de hoy y proximos 2 o 3 dias. |
| Censo de suplentes | Mostrar cuantos suplentes ya respondieron disponibilidad. |
| Alertas | Mostrar emails fallidos, turnos sin cobertura y respuestas vencidas. |

Acciones rapidas:

- Ver caso urgente.
- Ir al horario semanal.
- Reenviar invitaciones pendientes.
- Abrir censo de suplentes.

No debe mostrar:

- Logs tecnicos extensos.
- Tokens.
- Detalles de cron salvo estado simple.

### Horario semanal

Debe ser la pantalla principal de operacion.

Estados visuales:

- Titular pendiente.
- Confirmada.
- Rechazada.
- Buscando suplente.
- Suplente invitado.
- Cubierta por suplente.
- Requiere atencion.

Acciones por horario:

- Ver detalle.
- Editar titular.
- Reenviar email.
- Asignar suplente manual.
- Marcar como resuelto.
- Cancelar asignacion.

### Detalle de asignacion

Preferencia: panel lateral o modal.

Debe mostrar:

- Fecha.
- Horario.
- Punto.
- Titular.
- Estado del titular.
- Tiempo restante para responder.
- Suplente actual si existe.
- Candidatos intentados.
- Recordatorios enviados.
- Timeline completo.

Timeline ejemplo:

```txt
Asignacion creada
-> Email enviado al titular
-> Recordatorio 1 enviado
-> Titular no respondio
-> Sistema busco suplente
-> Email enviado a suplente
-> Suplente confirmo
```

Acciones manuales:

- Cambiar titular.
- Invitar otro suplente.
- Reenviar email.
- Resolver manualmente.
- Ver historial de emails.
- Cancelar asignacion.

Regla de UX:

- Este detalle no debe sentirse como una pantalla tecnica.
- Los logs deben aparecer como timeline legible.
- Los detalles tecnicos crudos deben quedar ocultos o en una seccion secundaria.

### Atencion requerida

Debe mostrar solo excepciones.

Casos:

- No hay suplente disponible.
- Suplente rechazo y no quedan candidatos.
- Suplente no respondio y no quedan candidatos.
- Email critico fallido.
- Turno cercano sin cobertura.

Columnas recomendadas:

| Columna | Uso |
| --- | --- |
| Prioridad | Urgente, alta, normal. |
| Fecha | Dia del turno. |
| Horario | Franja afectada. |
| Punto | Punto de predicacion. |
| Problema | Razon concreta. |
| Accion | Accion principal para resolver. |

Acciones:

- Asignar suplente manual.
- Reenviar email.
- Llamar o contactar fuera del sistema si el admin lo decide manualmente.
- Marcar como resuelto.
- Cancelar turno.
- Abrir detalle.

Regla:

- Esta pantalla evita que el admin tenga que buscar problemas manualmente.
- No debe mezclar casos ya resueltos con casos activos.
- Debe ordenar primero por urgencia y despues por fecha/hora del turno.

### Suplentes

Debe cubrir el censo semanal.

Debe mostrar:

- Semana actual.
- Estado del censo.
- Suplentes invitados.
- Suplentes que respondieron.
- No respondieron.
- Disponibilidad por dia.
- Disponibilidad por horario opcional.

Acciones:

- Abrir censo semanal.
- Enviar censo.
- Reenviar recordatorio.
- Registrar disponibilidad manual.
- Ver disponibilidad por dia.
- Ver disponibilidad por horario.

### Asignaciones / Historial

Debe ser una pantalla de consulta y auditoria, no la pantalla principal de operacion diaria.

Debe organizar por:

- Semana.
- Dia.
- Estado.
- Voluntario.
- Punto.
- Titular o suplente.

Usos:

- Revisar asignaciones pasadas.
- Auditar decisiones automaticas.
- Buscar historial por voluntario.
- Buscar historial por punto.
- Confirmar que una semana quedo completa.

Regla:

- No debe competir con "Horario semanal".
- La operacion diaria ocurre en "Horario semanal" y "Atencion requerida".

### Voluntarios

Debe manejar el directorio de personas disponibles para asignaciones.

Campos importantes:

- Nombre.
- Email.
- Telefono.
- Activo o inactivo.
- Puede ser suplente.
- Disponibilidad general.
- Historial de confirmaciones.
- Historial de rechazos.
- Historial de no respuesta.

Acciones:

- Crear voluntario.
- Editar contacto.
- Activar o desactivar.
- Marcar como suplente.
- Ver perfil.
- Ver asignaciones.

Regla:

- No mostrar metricas innecesarias que distraigan.
- Priorizar si la persona esta activa, si puede ser suplente y su disponibilidad.

### Perfil de voluntario

Debe ayudar al admin a decidir si una persona es buena candidata para cubrir turnos.

Debe mostrar:

```txt
Datos de contacto
Asignaciones proximas
Historial
Disponibilidad
Si puede servir como suplente
Notas internas
```

Acciones:

- Editar datos de contacto.
- Activar o desactivar.
- Marcar o desmarcar como suplente.
- Revisar asignaciones futuras.
- Registrar notas internas.

Regla:

- Evitar paneles visuales excesivos.
- Mostrar solo informacion util para operacion y reemplazos.

### Configuracion

Debe estar escondida del flujo principal.

Configuraciones visibles para admin:

| Configuracion | Valor inicial |
| --- | --- |
| Tiempo respuesta titular | 48 horas |
| Recordatorio titular 1 | 12 horas |
| Recordatorio titular 2 | 24 horas |
| Ultimo recordatorio titular | 40 horas |
| Tiempo respuesta suplente | 12 horas |
| Recordatorio suplente 1 | 4 horas |
| Ultimo recordatorio suplente | 8 horas |
| Recordatorios del turno | 5 dias, 1 dia, horas antes |
| Email del admin | Para alertas urgentes |

Tambien debe incluir:

- Templates de email.
- Estado simple del cron.
- Configuracion de remitente.
- Logs tecnicos basicos.

Regla:

- No crear pantallas separadas para logs, emails, cron o tokens.
- Esos detalles deben vivir en Detalle de asignacion o Configuracion.

## Modulo 12: UI Voluntario

La experiencia del voluntario debe ser directa y de baja friccion.

Pantallas necesarias:

- Confirmar asignacion por token.
- Responder censo semanal por token.
- Mis asignaciones.
- Mi disponibilidad.
- Perfil.

Confirmacion de asignacion:

- Mostrar informacion minima del turno.
- Boton "Si podre asistir".
- Boton "No podre asistir".
- Nota opcional.
- Mensaje claro despues de responder.

Censo semanal:

- Mostrar semana lunes a domingo.
- Permitir marcar dias disponibles.
- Permitir horario especifico opcional.
- Permitir guardar en pocos clics.
- Mostrar confirmacion de guardado.

Mis asignaciones:

- Pendientes.
- Confirmadas.
- Como titular.
- Como suplente.
- Historial.

Perfil:

- Nombre.
- Correo.
- Telefono.
- Disponibilidad general.
- Preferencias.

Regla:

- El voluntario no debe ver controles administrativos.
- Los links por token deben funcionar sin login mostrando informacion minima.
- Si el voluntario inicia sesion, puede ver mas contexto.

## Modulo 13: Templates de Email

Crear templates formales, reutilizables y consistentes.

Archivo sugerido:

```txt
services/email-template.service.ts
```

Templates necesarios:

- Invitacion titular.
- Recordatorio titular 12h.
- Recordatorio titular 24h.
- Ultimo recordatorio titular 40h.
- Censo semanal de suplentes.
- Recordatorio de censo.
- Invitacion suplente.
- Recordatorio suplente 4h.
- Ultimo recordatorio suplente 8h.
- Recordatorio del turno 5 dias antes.
- Recordatorio del turno 1 dia antes.
- Recordatorio final horas antes.
- Confirmacion recibida.
- Alerta admin: requiere intervencion.
- Email fallido o accion requerida por admin.

Cada template debe incluir:

- Subject claro.
- Saludo.
- Resumen de la accion requerida.
- Fecha.
- Horario.
- Punto, si aplica.
- CTA principal.
- URL completa como fallback.
- Texto breve.

Buenas practicas:

- No incluir tokens en logs.
- No exponer datos innecesarios.
- Mantener copia corta y clara.
- Usar subjects diferentes para evitar confusion.
- Incluir datos suficientes para actuar sin abrir multiples pantallas.

## Modulo 14: Settings y Configuracion

Crear configuraciones editables para evitar valores hardcodeados.

Settings sugeridos:

```ts
{
  primaryResponseTimeoutHours: 48,
  primaryReminderOffsetsHours: [12, 24, 40],
  replacementResponseTimeoutHours: 12,
  replacementReminderOffsetsHours: [4, 8],
  assignmentReminderTimingDays: [5, 1],
  assignmentFinalReminderHours: 3,
  censusResponseTimeoutHours: 72,
  censusReminderOffsetsHours: [24, 48],
  urgentThresholdHours: 72,
  adminAlertEmail: "admin@ppam.local"
}
```

Reglas:

- Validar que los offsets sean menores que el timeout.
- Validar que los emails admin sean validos.
- Versionar cambios importantes en settings.
- Mostrar defaults razonables si faltan settings.

## Modulo 15: Observabilidad y Auditoria

Todo el flujo debe ser trazable.

Usar:

- `NotificationLog` para envios.
- `AssignmentActivity` para decisiones de asignaciones.
- `AssignmentInvitation` para estado de invitaciones.
- `ReplacementCensus` para estado del censo.
- `ReplacementCensusResponse` para respuestas individuales al censo.
- `AppNotification` para alertas visibles en la app.

Eventos importantes:

- Semana creada.
- Titular editado.
- Invitacion titular creada.
- Email titular enviado.
- Recordatorio titular enviado.
- Titular acepto.
- Titular rechazo.
- Titular expiro.
- Censo creado.
- Censo enviado.
- Censo respondido.
- Suplente seleccionado.
- Invitacion suplente enviada.
- Recordatorio suplente enviado.
- Suplente acepto.
- Suplente rechazo.
- Suplente expiro.
- No hay suplente disponible.
- Admin alertado.
- Turno cubierto.
- Override manual.

Buenas practicas:

- No guardar secretos en metadata.
- No guardar tokens en logs de texto.
- Guardar ids y estados suficientes para auditoria.
- Permitir reconstruir el timeline de cada asignacion.
- Mantener logs de automatizacion separados de UI.

## Modulo 16: QA y Tests

Agregar pruebas para cubrir el flujo completo.

Tests minimos:

- Crear semana genera invitaciones titulares.
- Duplicar semana genera invitaciones titulares nuevas.
- Crear semana abre censo de suplentes.
- Censo genera respuestas para voluntarios suplentes activos.
- Suplente responde disponibilidad por dia.
- Suplente responde disponibilidad por horario especifico.
- Censo no duplica respuestas si corre dos veces.
- Titular recibe email inicial.
- Titular recibe recordatorios 12h, 24h y 40h sin duplicados.
- Titular confirma y queda `CONFIRMED`.
- Titular rechaza y dispara reemplazo.
- Titular expira a las 48h y dispara reemplazo.
- Busqueda prioriza horario exacto.
- Busqueda cae a dia disponible si no hay horario exacto.
- Busqueda cae a disponibilidad general si no hay dia especifico.
- Busqueda excluye titular que rechazo.
- Busqueda excluye candidatos ya intentados.
- Suplente recibe email inicial.
- Suplente recibe recordatorios 4h y 8h sin duplicados.
- Suplente confirma y queda como `isReplacement = true`.
- Suplente rechaza y se intenta otro candidato.
- Suplente expira a las 12h y se intenta otro candidato.
- Sin suplentes disponibles crea alerta admin.
- Email fallido crea alerta admin si es critico.
- Cron puede correr dos veces sin duplicar emails.
- Token expirado no permite responder.
- Token ya respondido no permite cambiar respuesta.
- UI admin muestra "Atencion requerida" solo para excepciones.
- UI voluntario permite confirmar/rechazar desde token.
- UI voluntario permite responder censo sin login mostrando datos minimos.

QA manual:

- Crear semana completa.
- Editar titulares antes de enviar.
- Abrir censo y responder como suplente.
- Confirmar titular.
- Rechazar titular.
- Cubrir con suplente exacto.
- Cubrir con suplente disponible por dia.
- Forzar caso sin suplente.
- Ver alerta admin.
- Revisar timeline.

## Prioridad de Implementacion

### P0

- Asegurar `AssignmentInvitation` y respuesta por token.
- Implementar censo semanal de suplentes.
- Guardar disponibilidad por dia y horario opcional.
- Enviar invitaciones titulares automaticamente.
- Enviar censo semanal automaticamente.
- Crear cron protegido.
- Procesar aceptacion/rechazo/expiracion del titular.
- Agregar alertas admin basicas.

### P1

- Implementar ranking de suplentes con prioridad:
  - horario exacto,
  - dia disponible,
  - disponibilidad general.
- Enviar invitacion de suplente.
- Procesar aceptacion/rechazo/expiracion del suplente.
- Intentar siguiente suplente automaticamente.
- Agregar recordatorios de titular 12h, 24h, 40h.
- Agregar recordatorios de suplente 4h, 8h.
- Agregar recordatorios del turno.
- Agregar notificaciones internas basicas.

### P2

- Mejorar UI admin:
  - Inicio operativo,
  - Horario semanal,
  - Atencion requerida,
  - Suplentes.
- Agregar timeline completo.
- Agregar overrides manuales.
- Agregar settings configurables.
- Mejorar templates visuales de email.
- Agregar metricas de cumplimiento.

### P3

- Mejorar observabilidad.
- Agregar reportes historicos.
- Agregar analitica de respuesta por voluntario.
- Preparar abstraccion de canales para futuro WhatsApp, SMS, push o llamadas.
- Agregar pruebas E2E completas.

## Criterios de Aceptacion

El flujo se considera listo cuando:

- El admin puede crear o duplicar una semana.
- Cada horario queda con titular asignado.
- El sistema envia invitaciones titulares sin accion manual adicional.
- El sistema abre y envia censo semanal a suplentes.
- Los suplentes pueden responder disponibilidad por dia.
- Los suplentes pueden especificar horario opcional.
- El titular puede confirmar o rechazar desde link seguro.
- Si el titular no responde en 48h, el sistema busca suplente.
- Si el titular rechaza, el sistema busca suplente.
- El sistema prioriza suplentes por horario exacto, dia disponible y disponibilidad general.
- El suplente puede confirmar o rechazar desde link seguro.
- Si el suplente no responde en 12h, el sistema intenta otro.
- Si no hay suplentes, el admin recibe alerta.
- Los voluntarios confirmados reciben recordatorios del turno.
- El cron puede correr cada 30 min sin duplicar mensajes.
- El admin ve excepciones en "Atencion requerida".
- El timeline permite auditar que hizo el sistema.

## Fuera de Alcance

No implementar en este plan:

- WhatsApp.
- SMS.
- Push notifications externas.
- Llamadas automaticas.
- Pagos o billing.
- Optimizaciones enterprise como colas externas dedicadas.
- Multi-organizacion.

La arquitectura debe dejar puntos de extension para esos canales, pero no deben bloquear el flujo gratuito.
