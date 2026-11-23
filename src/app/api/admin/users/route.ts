import { prisma } from "@/lib/db";
import { adminRoute, jsonOk, readJson } from "@/lib/api";
import { AppError, isUniqueViolation } from "@/lib/errors";
import { hashPassword, passwordPolicyError } from "@/lib/auth/password";
import { userInputSchema } from "@/lib/validation/admin";
import { writeAudit } from "@/services/audit";

export const POST = adminRoute("SUPER_ADMIN", async (req, { user, ipHash }) => {
  const input = userInputSchema.parse(await readJson(req));
  if (!input.password) throw new AppError("VALIDATION", "A password is required", 422);
  const policy = passwordPolicyError(input.password);
  if (policy) throw new AppError("WEAK_PASSWORD", policy, 422);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { name: input.name, email: input.email, role: input.role, passwordHash: await hashPassword(input.password!) } });
      await writeAudit(tx, { userId: user.id, action: "user.created", entityType: "User", entityId: u.id, metadata: { email: u.email, role: u.role }, ipHash });
      return u;
    });
    return jsonOk({ id: created.id }, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("EMAIL_TAKEN", "A user with this e-mail already exists", 409);
    throw e;
  }
});
