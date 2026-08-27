export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    // Fail-closed production env validation — no secrets logged, only variable names
    const { assertProductionEnv } = await import("./lib/server/env");
    assertProductionEnv();
  }
}
