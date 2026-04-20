import { PrismaClient } from "@prisma/client";

import { ensureServerEnvLoaded } from "@/lib/env/load-env";

ensureServerEnvLoaded();

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const db =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = db;
}
