export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { facilityCount } = await import("@/lib/seed");
    const count = await facilityCount();
    if (count === 0) {
      console.info("[bootstrap] No facilities found — setup required at /setup");
      return;
    }
    const { runScheduler } = await import("@/lib/scheduler");
    const globalRef = globalThis as typeof globalThis & { __sstCron?: NodeJS.Timeout };
    if (!globalRef.__sstCron) {
      globalRef.__sstCron = setInterval(
        () => {
          runScheduler(true).catch((err) => console.error("cron error", err));
        },
        60 * 60 * 1000,
      );
    }
  } catch (err) {
    console.error("instrumentation bootstrap failed", err);
  }
}
