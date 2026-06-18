import { existsSync, readdirSync, rmdirSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const cachePath = resolve(process.cwd(), ".next");

if (basename(cachePath) !== ".next") {
  throw new Error(`Refusing to remove unexpected path: ${cachePath}`);
}

if (!cachePath.startsWith(process.cwd())) {
  throw new Error(`Refusing to remove cache outside project: ${cachePath}`);
}

if (!existsSync(cachePath)) {
  console.log("Next.js cache not found. Nothing to clean.");
  process.exit(0);
}

for (const entry of readdirSync(cachePath)) {
  rmSync(join(cachePath, entry), { recursive: true, force: true });
}

try {
  rmdirSync(cachePath);
  console.log(`Removed ${cachePath}`);
} catch (error) {
  if (
    error instanceof Error &&
    "code" in error &&
    error.code === "EACCES" &&
    readdirSync(cachePath).length === 0
  ) {
    console.log(
      `Emptied ${cachePath}. The empty directory was kept because the OS denied removing it.`
    );
    process.exit(0);
  }

  throw error;
}
