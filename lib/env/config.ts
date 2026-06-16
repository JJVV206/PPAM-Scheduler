const LOCAL_DEV_SECRET = "ppam-scheduler-local-dev-secret";
const LOCAL_DEV_BASE_URL = "http://localhost:3000";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
const PLACEHOLDER_SECRET = "replace-with-a-long-random-secret";

type SmtpConfig = {
  auth?: {
    user: string;
    pass: string;
  };
  from: string;
  host: string;
  port: number;
  secure: boolean;
};

function hasValue(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

export function getRequiredAppEnvKeys() {
  return isProductionRuntime()
    ? ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL", "CRON_SECRET"] as const
    : ["DATABASE_URL"] as const;
}

export function getMissingRequiredAppEnv() {
  return getRequiredAppEnvKeys().filter((key) => {
    const value = process.env[key];

    if (!hasValue(value)) {
      return true;
    }

    if (key === "NEXTAUTH_SECRET") {
      return value.trim() === PLACEHOLDER_SECRET;
    }

    return false;
  });
}

export function getSessionSecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim();

  if (hasValue(secret) && secret !== PLACEHOLDER_SECRET) {
    return secret;
  }

  if (!isProductionRuntime()) {
    return LOCAL_DEV_SECRET;
  }

  throw new Error(
    "NEXTAUTH_SECRET debe configurarse con un valor aleatorio y no temporal en producción."
  );
}

export function getAppBaseUrl() {
  const rawValue = process.env.NEXTAUTH_URL?.trim();

  if (!hasValue(rawValue)) {
    if (!isProductionRuntime()) {
      return LOCAL_DEV_BASE_URL;
    }

    throw new Error("NEXTAUTH_URL es obligatorio en producción.");
  }

  const url = new URL(rawValue);

  if (isProductionRuntime() && LOCAL_HOSTNAMES.has(url.hostname)) {
    throw new Error(
      "NEXTAUTH_URL no puede apuntar a localhost o 127.0.0.1 en producción."
    );
  }

  return rawValue.replace(/\/$/, "");
}

export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();

  if (!hasValue(host) || !hasValue(from)) {
    if (isProductionRuntime()) {
      throw new Error(
        "SMTP_HOST y SMTP_FROM son obligatorios en producción para enviar correos."
      );
    }

    return null;
  }

  const portValue = process.env.SMTP_PORT?.trim() ?? "1025";
  const port = Number(portValue);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("SMTP_PORT debe ser un entero positivo.");
  }

  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if ((hasValue(user) && !hasValue(pass)) || (!hasValue(user) && hasValue(pass))) {
    throw new Error(
      "SMTP_USER y SMTP_PASS deben configurarse juntos cuando se use autenticación SMTP."
    );
  }

  const secureValue = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure =
    secureValue === "true" ? true : secureValue === "false" ? false : port === 465;

  return {
    host,
    port,
    secure,
    from,
    auth: hasValue(user) && hasValue(pass) ? { user, pass } : undefined
  };
}
