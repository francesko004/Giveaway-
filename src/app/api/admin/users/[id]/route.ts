import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminRoute, jsonOk, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { hashPassword, passwordPolicyError } from "@/lib/auth/password";
import { destroyAllSessions } from "@/lib/auth/session";
import { writeAudit } from "@/services/audit";

const schema = z.object({
  role: z.enum(["SUPER_ADMIN", "ADMIN", "VIEWER"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(12).max(256).optional(),
});

export const PATCH = adminRoute<{ id: string }>("SUPER_ADMIN", async (req, { user, ipHash }, { id }) => {
  const input = schema.parse(await readJson(req));
  if (id === user.id && (input.active === false || (input.role && input.role !== "SUPER_ADMIN"))) {
    throw new AppError("SELF", "You cannot deactivate or demote your own account", 409);
  }
  if (input.password) {
    const policy = passwordPolicyError(input.password);
    if (policy) throw new AppError("WEAK_PASSWORD", policy, 422);
  }
  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id } });
    if (!target) throw new AppError("NOT_FOUND", "User not found", 404);
    if ((input.active === false || (input.role && input.role !== "SUPER_ADMIN")) && target.role === "SUPER_ADMIN") {
      const remaining = await tx.user.count({ where: { role: "SUPER_ADMIN", active: true, id: { not: id } } });
      if (remaining === 0) throw new AppError("LAST_SUPER_ADMIN", "At least one active super admin is required", 409);
    }
    await tx.user.update({
      where: { id },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.password ? { passwordHash: await hashPassword(input.password), failedLogins: 0, lockedUntil: null } : {}),
      },
    });
    await writeAudit(tx, { userId: user.id, action: "user.updated", entityType: "User", entityId: id, metadata: { role: input.role, active: input.active, passwordReset: !!input.password }, ipHash });
  });
  if (input.active === false || input.password || input.role) await destroyAllSessions(id);
  return jsonOk({ ok: true });
});
