import { Prisma } from "@prisma/client";

const SENSITIVE_METADATA_KEYS = new Set([
  "confirmationlink",
  "confirmationtoken",
  "invitationtoken",
  "password",
  "passwordhash",
  "reseturl",
  "resettoken",
  "responseurl",
  "secret",
  "token"
]);

function isSensitiveMetadataKey(key: string) {
  const normalizedKey = key.toLowerCase();

  return (
    SENSITIVE_METADATA_KEYS.has(normalizedKey) ||
    normalizedKey.endsWith("token") ||
    normalizedKey.endsWith("password") ||
    normalizedKey.endsWith("secret")
  );
}

function normalizeMetadataValue(
  key: string,
  value: unknown
): Prisma.InputJsonValue | undefined {
  if (
    value === undefined ||
    value === null ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    isSensitiveMetadataKey(key)
  ) {
    return undefined;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    const values = value
      .map((item) => normalizeMetadataValue("", item))
      .filter((item): item is Prisma.InputJsonValue => item !== undefined);

    return values.length ? values : undefined;
  }

  if (typeof value === "object") {
    const metadata = compactJsonMetadata(value as Record<string, unknown>);

    return Object.keys(metadata).length ? metadata : undefined;
  }

  return undefined;
}

export function compactJsonMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata)
      .map(([key, value]) => [key, normalizeMetadataValue(key, value)] as const)
      .filter(([, value]) => value !== undefined)
  ) as Prisma.InputJsonObject;
}

export function safeJsonMetadata(
  metadata?: Record<string, unknown>
): Prisma.InputJsonObject | undefined {
  if (!metadata) {
    return undefined;
  }

  const compacted = compactJsonMetadata(metadata);

  return Object.keys(compacted).length ? compacted : undefined;
}

export function asJsonObject(value: Prisma.JsonValue | null) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function mergeJsonMetadata(
  current: Prisma.JsonValue | null,
  next: Record<string, unknown>
) {
  return compactJsonMetadata({
    ...asJsonObject(current),
    ...next
  });
}
