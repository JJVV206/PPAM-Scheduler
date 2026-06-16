#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const REQUIRED_PRODUCTION_DB_ENV = ["DATABASE_URL", "DIRECT_URL"];

function hasValue(key) {
  return (
    typeof process.env[key] === "string" &&
    process.env[key].trim().length > 0
  );
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exitCode = result.status ?? 1;

  if (process.exitCode !== 0) {
    process.exit(process.exitCode);
  }
}

const isProductionDeployment = process.env.VERCEL_ENV === "production";
const skipMigrations = ["1", "true"].includes(
  process.env.SKIP_PRISMA_MIGRATE?.toLowerCase() ?? ""
);

if (isProductionDeployment && !skipMigrations) {
  const missingEnv = REQUIRED_PRODUCTION_DB_ENV.filter((key) => !hasValue(key));

  if (missingEnv.length > 0) {
    console.error(
      `Missing production database environment variables: ${missingEnv.join(", ")}.`
    );
    console.error(
      "Configure DATABASE_URL and DIRECT_URL before deploying to production."
    );
    process.exit(1);
  }

  console.log("Running production database migrations...");
  run("prisma", ["migrate", "deploy"]);
} else {
  const reason = skipMigrations
    ? "SKIP_PRISMA_MIGRATE is enabled"
    : "not a production Vercel deployment";
  console.log(`Skipping production database migrations: ${reason}.`);
}

console.log("Generating Prisma client...");
run("prisma", ["generate"]);

if (isProductionDeployment) {
  console.log("Running production account maintenance...");
  run("node", ["scripts/delete-user-account.mjs"]);
}

console.log("Building Next.js application...");
run("next", ["build"]);
