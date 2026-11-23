/**
 * Built-in scheduler: runs the idempotent housekeeping tick every 30 s on the Node.js server
 * (auto-close campaigns, reveal due draws, purge expired sessions). Disable with DISABLE_SCHEDULER=1
 * when running several instances and use POST /api/cron/tick from a single external cron instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_SCHEDULER === "1" || process.env.NODE_ENV === "test") return;
  const { runTick } = await import("./services/scheduler");
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runTick();
    } catch (e) {
      console.error("[scheduler] tick failed:", (e as Error).message);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 5_000);
  setInterval(tick, 30_000).unref?.();
}
