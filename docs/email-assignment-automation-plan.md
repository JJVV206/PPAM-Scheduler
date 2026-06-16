# Plan de Automatizacion de Asignaciones por Email

## Objetivo

Convertir PPAM Scheduler de un planificador principalmente manual a un sistema semi-automatico de asignacion, invitacion, confirmacion, reemplazo y seguimiento por correo electronico.

El administrador solo debe intervenir cuando el sistema no pueda resolver automaticamente una cobertura:

- El titular rechaza o no responde.
- El suplente/reemplazo rechaza o no responde.
- No hay suplente disponible para ese horario.
- Falla el envio de un correo critico.

Este plan excluye por ahora:

- WhatsApp.
- Llamadas automaticas.
- Push notifications.
- SMS.

La arquitectura debe quedar lista para agregar esos canales despues, pero el alcance inicial debe ejecutarse solo por email.

## Modulo 1: Modelo de Datos

Agregar soporte explicito para invitaciones, suplentes y trazabilidad del proceso automatico.

Features:

- Crear entidad `AssignmentInvitation`.
- Relacionar cada invitacion con una asignacion y un voluntario.
- Distinguir invitaciones de titular y suplente.
- Guardar token seguro para responder desde link directo.
- Guardar estado de envio y respuesta.
- Guardar expiracion de invitacion.
- Guardar intentos de email.
- Guardar metadata operativa.

Campos sugeridos:

```prisma
enum AssignmentInvitationType {
  PRIMARY
  REPLACEMENT
}

enum AssignmentInvitationStatus {
  PENDING
  SENT
  ACCEPTED
  DECLINED
  EXPIRED
  FAILED
}

model AssignmentInvitation {
  id             String                     @id @default(cuid())
  assignmentId   String
  volunteerId    String
  type           AssignmentInvitationType
  status         AssignmentInvitationStatus @default(PENDING)
  token          String                     @unique
  sentAt         DateTime?
  respondedAt    DateTime?
  expiresAt      DateTime
  emailAttempts  Int                        @default(0)
  metadata       Json?
  createdAt      DateTime                   @default(now())
  updatedAt      DateTime                   @updatedAt

  assignment     Assignment                 @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  volunteer      VolunteerProfile           @relation(fields: [volunteerId], references: [id], onDelete: Cascade)

  @@index([assignmentId, status])
  @@index([volunteerId, status])
  @@index([expiresAt, status])
}
```

Agregar capacidad de suplente en `VolunteerProfile`:

```prisma
canServeAsReplacement Boolean @default(true)
```

Si despues se necesita un control mas avanzado, se puede crear una tabla `ReplacementPool`, pero para el primer alcance basta con el booleano.

## Modulo 2: Invitacion Inicial Automatica

Cuando el admin cree o duplique una semana, el sistema debe generar y enviar automaticamente invitaciones por email a los titulares.

Features:

- Al crear una asignacion con voluntarios titulares, crear invitaciones `PRIMARY`.
- Al duplicar una semana, crear invitaciones `PRIMARY` para cada asignacion duplicada.
- Enviar correo automatico al titular.
- Registrar el envio en `NotificationLog`.
- Registrar actividad en `AssignmentActivity`.
- Evitar duplicados: no crear otra invitacion activa para el mismo voluntario y asignacion si ya existe.

Email inicial debe incluir:

- Nombre del voluntario.
- Fecha.
- Horario.
- Punto de predicacion.
- Link directo para confirmar.
- Link directo para rechazar, o una pantalla con ambos botones.
- Texto de fallback con URL completa.

Resultado esperado:

- El admin prepara la semana.
- El sistema manda los correos sin que el admin tenga que abrir cada asignacion y presionar "Solicitar confirmacion".

## Modulo 3: Confirmacion por Link Seguro

Reemplazar el flujo basado directamente en `responseId` por un token seguro de invitacion.

Ruta sugerida:

```txt
/confirm-assignment/[token]
```

Features:

- Buscar `AssignmentInvitation` por token.
- Validar que exista.
- Validar que no este expirada.
- Validar que no haya sido respondida.
- Mostrar pantalla de confirmacion con:
  - Fecha.
  - Horario.
  - Punto.
  - Boton "Si podre asistir".
  - Boton "No podre asistir".
  - Nota opcional.
- Si el voluntario confirma:
  - Marcar invitacion como `ACCEPTED`.
  - Actualizar/crear `AssignmentResponse` como `CONFIRMED`.
  - Recalcular estado de asignacion.
  - Registrar actividad.
- Si el voluntario rechaza:
  - Marcar invitacion como `DECLINED`.
  - Actualizar/crear `AssignmentResponse` como `DECLINED`.
  - Recalcular estado de asignacion.
  - Ejecutar flujo automatico de suplente.

Regla importante:

- El link puede permitir responder sin login, pero solo debe exponer informacion minima de la asignacion.
- Si el usuario ya inicio sesion, se puede mostrar mas contexto.

## Modulo 4: Motor de Automatizacion

Crear un servicio central para tomar decisiones automaticamente.

Archivo sugerido:

```txt
services/assignment-automation.service.ts
```

Responsabilidades:

- Enviar invitaciones pendientes.
- Revisar invitaciones expiradas.
- Procesar rechazos.
- Buscar suplentes disponibles.
- Crear invitaciones de reemplazo.
- Enviar emails de reemplazo.
- Enviar recordatorios.
- Notificar al admin por email cuando se requiera intervencion humana.

Funciones sugeridas:

```ts
processAssignmentAutomationRun()
sendPendingPrimaryInvitations()
expireTimedOutInvitations()
processAssignmentsNeedingReplacement()
inviteNextAvailableReplacement()
sendDueAssignmentReminders()
notifyAdminsForUnresolvedAssignments()
```

Requisitos:

- Debe ser idempotente.
- Debe poder correr cada 30 o 60 minutos sin duplicar correos.
- Debe registrar cada decision en `AssignmentActivity`.
- Debe registrar cada envio en `NotificationLog`.

## Modulo 5: Reglas de Suplentes

Automatizar seleccion de reemplazos usando disponibilidad.

Un voluntario es elegible como suplente si:

- Esta activo.
- Su usuario esta activo.
- `canServeAsReplacement = true`.
- No esta temporalmente no disponible.
- Tiene disponibilidad para el dia y horario.
- No tiene excepcion de disponibilidad activa en esa fecha.
- No esta asignado a otro turno en la misma fecha y horario.
- No es el titular que rechazo.
- No fue intentado ya para esa asignacion.

Prioridad sugerida:

1. Disponible en el horario exacto.
2. Marcado como suplente.
3. Preferencia de area compatible.
4. Mejor historial de confirmacion.
5. Menor cantidad de asignaciones futuras.
6. Orden alfabetico como desempate estable.

Resultado esperado:

- Si el titular rechaza, el sistema no avisa todavia al admin.
- Primero busca suplente.
- Invita por email al mejor candidato.
- Espera respuesta.
- Si acepta, se actualiza la asignacion.
- Si rechaza o expira, intenta con el siguiente.
- Solo alerta al admin si ya no hay candidatos.

## Modulo 6: Flujo de Reemplazo

Cuando un titular rechaza o no responde dentro del tiempo configurado:

1. Marcar invitacion del titular como `DECLINED` o `EXPIRED`.
2. Marcar la asignacion como `NEEDS_REPLACEMENT`.
3. Buscar candidatos suplentes.
4. Crear invitacion `REPLACEMENT` para el mejor candidato.
5. Enviar email al suplente.
6. Marcar asignacion como estado operativo tipo "esperando suplente" si se agrega un nuevo estado.

Cuando el suplente acepta:

- Crear o actualizar `AssignmentVolunteer`.
- Marcar `isReplacement = true`.
- Crear o actualizar `AssignmentResponse` como `CONFIRMED`.
- Marcar invitacion como `ACCEPTED`.
- Recalcular estado de la asignacion.
- Registrar actividad `REPLACEMENT_ASSIGNED`.

Cuando el suplente rechaza:

- Marcar invitacion como `DECLINED`.
- Intentar el siguiente candidato.
- Si no hay mas candidatos, enviar alerta al admin por email.

## Modulo 7: Recordatorios por Email

Implementar los recordatorios automaticos por correo.

Cadencia inicial:

- 5 dias antes.
- 1 dia antes.
- Horas antes, por ejemplo 3 horas antes.

Settings sugeridos:

```ts
reminderTimingDays: [5, 1]
finalReminderHours: 3
replacementResponseTimeoutHours: 12
primaryResponseTimeoutHours: 48
```

Reglas:

- Enviar recordatorios a voluntarios confirmados.
- Enviar recordatorios a voluntarios pendientes antes del vencimiento.
- No enviar recordatorios a voluntarios que rechazaron.
- No duplicar recordatorios ya enviados.
- Registrar cada recordatorio en `NotificationLog`.
- Registrar actividad `REMINDER_SENT`.

Tipos de email:

- Recordatorio 5 dias antes.
- Recordatorio 1 dia antes.
- Recordatorio horas antes.
- Recordatorio de confirmacion pendiente.

## Modulo 8: Cron en Vercel

Crear endpoint cron para ejecutar el motor automatico.

Ruta sugerida:

```txt
/api/cron/assignment-automation
```

Proteccion:

- Usar `CRON_SECRET`.
- Rechazar requests sin header valido.

Ejemplo:

```ts
const authHeader = request.headers.get("authorization");
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

Agregar a `vercel.json`:

```json
{
  "buildCommand": "npm run vercel:build",
  "crons": [
    {
      "path": "/api/cron/assignment-automation",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

El cron debe ejecutar:

- Envio de invitaciones pendientes.
- Expiracion de invitaciones sin respuesta.
- Busqueda e invitacion de suplentes.
- Recordatorios por email.
- Alertas al admin.

## Modulo 9: Alertas al Admin por Email

El admin solo debe recibir correo cuando el sistema no pueda resolver solo.

Casos:

- Titular rechaza y no hay suplente disponible.
- Titular no responde y no hay suplente disponible.
- Suplente rechaza y no hay mas candidatos.
- Suplente no responde y no hay mas candidatos.
- Fallo el envio de email a titular o suplente.

Email al admin debe incluir:

- Asunto urgente.
- Fecha.
- Horario.
- Punto.
- Titular original.
- Suplentes intentados.
- Razon por la que requiere intervencion.
- Link directo al detalle de la asignacion.

Ejemplo de asunto:

```txt
Urgente: asignacion sin cobertura para viernes 12 de junio, 11:00 - 13:00
```

## Modulo 10: UI Admin

Ajustar la UI para reflejar el proceso automatico.

Features:

- Agregar seccion "Requiere atencion".
- Mostrar estado de invitacion:
  - Invitacion pendiente.
  - Email enviado.
  - Esperando respuesta.
  - Confirmado.
  - Rechazado.
  - Expirado.
  - Buscando suplente.
  - Suplente invitado.
  - Requiere intervencion.
- En detalle de asignacion mostrar timeline completo:
  - Asignacion creada.
  - Invitacion enviada.
  - Respuesta recibida.
  - Suplente seleccionado.
  - Recordatorio enviado.
  - Admin alertado.
- Mantener overrides manuales:
  - Reenviar email.
  - Asignar suplente manualmente.
  - Marcar como resuelto.
  - Cancelar asignacion.

No debe requerirse que el admin envie manualmente la invitacion inicial.

## Modulo 11: UI Voluntario

Simplificar la experiencia del voluntario.

Features:

- Dashboard con:
  - Asignaciones pendientes de respuesta.
  - Asignaciones confirmadas.
  - Historial.
- Cada asignacion debe tener:
  - "Si podre asistir".
  - "No podre asistir".
  - Nota opcional.
- Mostrar si la asignacion es como titular o suplente.
- Mostrar recordatorios recibidos.
- Perfil debe mostrar:
  - Nombre.
  - Correo.
  - Telefono.
  - Disponibilidad.

Por ahora el telefono solo se guarda para futuro uso. No implementar WhatsApp, SMS ni llamadas.

## Modulo 12: Templates de Email

Crear templates formales y reutilizables.

Archivo sugerido:

```txt
services/email-template.service.ts
```

Templates necesarios:

- Invitacion titular.
- Invitacion suplente.
- Recordatorio 5 dias antes.
- Recordatorio 1 dia antes.
- Recordatorio horas antes.
- Confirmacion recibida.
- Alerta admin: requiere intervencion.

Cada template debe incluir:

- Subject claro.
- Saludo.
- Resumen de asignacion.
- CTA principal.
- URL completa como fallback.
- Texto breve y directo.

## Modulo 13: Observabilidad y Auditoria

Toda decision automatica debe quedar trazable.

Usar:

- `NotificationLog` para envios.
- `AssignmentActivity` para decisiones del motor.
- `AssignmentInvitation` para estado de invitaciones.

Eventos importantes:

- Invitacion creada.
- Email enviado.
- Email fallido.
- Invitacion aceptada.
- Invitacion rechazada.
- Invitacion expirada.
- Suplente seleccionado.
- Sin suplente disponible.
- Admin alertado.
- Recordatorio enviado.

## Modulo 14: QA y Tests

Agregar pruebas para el motor automatico.

Tests minimos:

- Crear asignacion genera invitacion titular.
- Duplicar semana genera invitaciones titulares.
- Invitacion titular envia email.
- Titular confirma y cambia respuesta a `CONFIRMED`.
- Titular rechaza y dispara busqueda de suplente.
- Suplente acepta y queda como reemplazo confirmado.
- Suplente rechaza y se intenta otro candidato.
- Sin suplentes disponibles se envia email al admin.
- Recordatorios de 5 dias no se duplican.
- Recordatorios de 1 dia no se duplican.
- Recordatorio final por horas no se duplica.
- Cron puede correr dos veces sin duplicar correos.
- Token expirado no permite responder.
- Token ya respondido no permite cambiar respuesta sin regla explicita.

## Prioridad de Implementacion

### P0

- Crear `AssignmentInvitation`.
- Crear links seguros por token.
- Enviar invitacion inicial automaticamente por email.
- Implementar respuesta por token.
- Crear cron protegido con `CRON_SECRET`.
- Procesar confirmacion y rechazo del titular.

### P1

- Implementar seleccion automatica de suplentes.
- Enviar invitacion de suplente por email.
- Procesar aceptacion/rechazo de suplente.
- Alertar admin por email cuando no haya cobertura.
- Agregar recordatorios 5 dias, 1 dia y horas antes.

### P2

- Mejorar UI admin con "Requiere atencion".
- Mejorar timeline completo.
- Agregar metricas de cumplimiento.
- Agregar settings avanzados.
- Mejorar templates visuales de email.

## Criterios de Aceptacion

El sistema cumple el objetivo cuando:

- El admin puede crear o duplicar semana y los titulares reciben email automaticamente.
- El titular puede confirmar o rechazar desde un link seguro.
- Si el titular rechaza o expira, el sistema intenta encontrar suplente.
- El suplente recibe email y puede confirmar o rechazar.
- Si el suplente acepta, queda como reemplazo de la asignacion.
- Si nadie puede cubrir, el admin recibe alerta urgente por email.
- Los recordatorios se envian automaticamente por email.
- No se duplican emails por ejecuciones repetidas del cron.
- Todo queda registrado en logs y timeline.

## Fuera de Alcance por Ahora

No implementar en esta fase:

- WhatsApp.
- SMS.
- Push notifications.
- Llamadas automaticas.
- Costos o integracion con proveedores de mensajeria externa.
- Automatizacion telefonica.

La unica via de comunicacion automatica en esta fase es email.
