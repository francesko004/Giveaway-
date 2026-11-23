/**
 * Creates (or resets the password of) an administrator.
 *
 *   npm run admin:create -- --email admin@example.al --name "Admin" --role SUPER_ADMIN
 *
 * The password is read from ADMIN_PASSWORD or prompted interactively (never passed as an argument,
 * so it does not end up in shell history).
 */
import { createInterface } from "node:readline/promises";
import { hashPassword } from "../src/lib/auth/hash";
import { prisma } from "./db";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function readPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const pw = await rl.question("Password (min. 12 chars, letters + numbers): ");
  rl.close();
  return pw;
}

async function main() {
  const email = (arg("email") ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = arg("name") ?? process.env.ADMIN_NAME ?? "Administrator";
  const role = (arg("role") ?? "SUPER_ADMIN") as "SUPER_ADMIN" | "ADMIN" | "VIEWER";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Provide --email");
  if (!["SUPER_ADMIN", "ADMIN", "VIEWER"].includes(role)) throw new Error("Invalid --role");
  const password = await readPassword();
  if (password.length < 12 || !/[a-z]/i.test(password) || !/\d/.test(password)) throw new Error("Password must be ≥ 12 characters with letters and numbers");
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role, active: true, failedLogins: 0, lockedUntil: null },
    create: { email, name, role, passwordHash },
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log(`✓ ${role} ${email} ready`);
}

main()
  .catch((e) => {
    console.error("✗", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
