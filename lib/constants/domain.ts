import type { TimeSlot } from "@/types/domain";

export const USER_ROLES = ["ADMIN", "VOLUNTEER"] as const;
export const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY"
] as const;
export const TIME_SLOTS = [
  "SLOT_07_09",
  "SLOT_09_11",
  "SLOT_11_13",
  "SLOT_13_15",
  "SLOT_15_17"
] as const;
export const ASSIGNMENT_STATUSES = [
  "SCHEDULED",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "DECLINED",
  "NEEDS_REPLACEMENT",
  "REASSIGNED",
  "COMPLETED",
  "CANCELLED"
] as const;
export const RESPONSE_STATUSES = ["PENDING", "CONFIRMED", "DECLINED"] as const;
export const VOLUNTEER_POSITIONS = ["FIRST", "SECOND"] as const;
export const NOTIFICATION_TYPES = [
  "CONFIRMATION_REQUEST",
  "REMINDER",
  "REPLACEMENT_OPPORTUNITY",
  "FINAL_REMINDER",
  "RESET_PASSWORD",
  "ASSIGNMENT_UPDATE"
] as const;
export const NOTIFICATION_CHANNELS = ["EMAIL", "SMS", "WHATSAPP", "IN_APP"] as const;
export const NOTIFICATION_STATUSES = ["PENDING", "SENT", "FAILED"] as const;
export const ASSIGNMENT_ACTIVITY_TYPES = [
  "ASSIGNED",
  "REMINDER_SENT",
  "RESPONSE_RECEIVED",
  "REPLACEMENT_ASSIGNED",
  "STATUS_OVERRIDDEN",
  "COMPLETED",
  "CANCELLED",
  "NOTES_UPDATED"
] as const;

export const TIME_SLOT_DEFINITIONS: Record<
  TimeSlot,
  {
    label: string;
    shortLabel: string;
    start: string;
    end: string;
  }
> = {
  SLOT_07_09: {
    label: "07:00 - 09:00",
    shortLabel: "07:00-09:00",
    start: "07:00",
    end: "09:00"
  },
  SLOT_09_11: {
    label: "09:00 - 11:00",
    shortLabel: "09:00-11:00",
    start: "09:00",
    end: "11:00"
  },
  SLOT_11_13: {
    label: "11:00 - 13:00",
    shortLabel: "11:00-13:00",
    start: "11:00",
    end: "13:00"
  },
  SLOT_13_15: {
    label: "13:00 - 15:00",
    shortLabel: "13:00-15:00",
    start: "13:00",
    end: "15:00"
  },
  SLOT_15_17: {
    label: "15:00 - 17:00",
    shortLabel: "15:00-17:00",
    start: "15:00",
    end: "17:00"
  }
};

export const DAY_LABELS = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo"
} as const;

export const ROLE_LABELS = {
  ADMIN: "Administrador",
  VOLUNTEER: "Voluntario"
} as const;

export const VOLUNTEER_POSITION_LABELS = {
  FIRST: "Puesto 1",
  SECOND: "Puesto 2"
} as const;

export const NOTIFICATION_TYPE_LABELS = {
  CONFIRMATION_REQUEST: "Solicitud de confirmación",
  REMINDER: "Recordatorio",
  REPLACEMENT_OPPORTUNITY: "Oportunidad de reemplazo",
  FINAL_REMINDER: "Recordatorio final",
  RESET_PASSWORD: "Restablecimiento de contraseña",
  ASSIGNMENT_UPDATE: "Actualización de asignación"
} as const;

export const NOTIFICATION_CHANNEL_LABELS = {
  EMAIL: "Correo",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  IN_APP: "En la app"
} as const;

export const NOTIFICATION_STATUS_LABELS = {
  PENDING: "Pendiente",
  SENT: "Enviado",
  FAILED: "Fallido"
} as const;

export const ASSIGNMENT_ACTIVITY_LABELS = {
  ASSIGNED: "Asignado",
  REMINDER_SENT: "Recordatorio enviado",
  RESPONSE_RECEIVED: "Respuesta recibida",
  REPLACEMENT_ASSIGNED: "Reemplazo asignado",
  STATUS_OVERRIDDEN: "Estado ajustado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  NOTES_UPDATED: "Notas actualizadas"
} as const;
