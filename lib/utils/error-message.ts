const ERROR_PATTERNS: Array<[RegExp, string]> = [
  [
    /connect ECONNREFUSED|ECONNREFUSED/i,
    "No fue posible enviar el correo. El servicio de correo no está disponible."
  ],
  [
    /SMTP_HOST y SMTP_FROM son obligatorios|SMTP_HOST|SMTP_FROM/i,
    "Falta configurar el servicio de correo."
  ],
  [
    /SMTP_PORT debe ser un entero positivo|SMTP_USER y SMTP_PASS|SMTP_SECURE|configuración SMTP|SMTP/i,
    "La configuración del correo no es válida."
  ],
  [
    /No se encontró un correo para el destinatario/i,
    "El destinatario no tiene un correo registrado."
  ],
  [
    /Unique constraint failed|P2002/i,
    "Ya existe un registro con esos datos."
  ],
  [
    /Foreign key constraint violated|P2003/i,
    "No se pudo completar la acción con los datos relacionados."
  ],
  [
    /Record to update not found|Record to delete does not exist|P2025/i,
    "El registro que intentas usar ya no está disponible."
  ],
  [
    /Validation failed/i,
    "Revisa los campos capturados e inténtalo de nuevo."
  ],
  [
    /Invalid `prisma\..+?` invocation/i,
    "No fue posible guardar la información."
  ]
];

export function humanizeErrorMessage(
  message?: string | null,
  fallback = "Ocurrió un error. Inténtalo de nuevo."
) {
  if (!message) {
    return fallback;
  }

  const normalized = message.trim();

  for (const [pattern, humanMessage] of ERROR_PATTERNS) {
    if (pattern.test(normalized)) {
      return humanMessage;
    }
  }

  return normalized;
}
