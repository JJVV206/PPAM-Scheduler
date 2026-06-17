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

type ResendConfig = {
  apiKey: string;
  from: string;
};

type EmailDeliveryConfig =
  | ({
      provider: "resend";
    } & ResendConfig)
  | ({
      provider: "smtp";
    } & SmtpConfig);

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

export function getRequiredAuthEnvKeys() {
  return isProductionRuntime()
    ? ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"] as const
    : ["DATABASE_URL"] as const;
}

function getMissingEnv(keys: readonly string[]) {
  return keys.filter((key) => {
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

export function getMissingRequiredAppEnv() {
  return getMissingEnv(getRequiredAppEnvKeys());
}

export function getMissingRequiredAuthEnv() {
  return getMissingEnv(getRequiredAuthEnvKeys());
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

export function getResendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();

  if (!hasValue(apiKey) && !hasValue(from)) {
    return null;
  }

  if (!hasValue(apiKey) || !hasValue(from)) {
    throw new Error(
      "RESEND_API_KEY y RESEND_FROM deben configurarse juntos para enviar correos con Resend."
    );
  }

  return {
    apiKey,
    from
  };
}

export function getEmailDeliveryConfig(): EmailDeliveryConfig | null {
  const resend = getResendConfig();
  if (resend) {
    return {
      provider: "resend",
      ...resend
    };
  }

  const smtp = getSmtpConfig();
  if (smtp) {
    return {
      provider: "smtp",
      ...smtp
    };
  }

  if (isProductionRuntime()) {
    throw new Error(
      "RESEND_API_KEY/RESEND_FROM o SMTP_HOST/SMTP_FROM son obligatorios en producción para enviar correos."
    );
  }

  return null;
}
