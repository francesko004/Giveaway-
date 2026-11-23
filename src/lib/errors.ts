/** Error whose message is safe to show to end users. Anything else is reported as a generic error. */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;

/** True when Postgres raised one of our integrity-guard exceptions (see the integrity_guards migration). */
export function isIntegrityGuardError(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? "");
  return msg.includes("GV_IMMUTABLE") || msg.includes("GV_LOCKED");
}

/** Prisma unique-constraint violation. */
export function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === "P2002" || /Unique constraint/i.test(err?.message ?? "");
}
