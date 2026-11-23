import { execSync } from "node:child_process";

export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql://postgres@localhost:5432/giveaway_e2e" };
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("npx tsx tests/e2e/seed.ts", { env, stdio: "inherit" });
}
