// ---- API Usage Tracking ----

let _trackCallback: ((service: string, latencyMs: number, success: boolean) => void) | null = null;

/**
 * Register a callback to track API usage. Called once per Convex action.
 * Pass null to clear.
 */
export function setTrackCallback(cb: typeof _trackCallback) {
  _trackCallback = cb;
}

/** Map retry label prefixes to service names. */
function inferService(label: string): string {
  const l = label.toLowerCase();
  if (l.startsWith("falcon")) return "falcon";
  if (l.startsWith("subgraph")) return "subgraph";
  if (l.startsWith("bitquery")) return "bitquery";
  if (l.startsWith("rpc-")) return "alchemy";
  if (l.startsWith("openrouter")) return "openrouter";
  if (l.startsWith("fetch-trending") || l.startsWith("fetch-market")) return "gamma_api";
  if (l.startsWith("fetch-activity") || l.startsWith("fetch-positions") || l.startsWith("fetch-leaderboard") || l.startsWith("fetch-recent-trades")) return "data_api";
  if (l.includes("clob") || l.includes("order") || l.includes("orderbook")) return "clob_api";
  return "other";
}

// ---- Retry with Tracking ----

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, label = "operation" } = opts;
  const start = Date.now();
  let success = true;

  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) {
          console.error(`[retry] ${label} failed after ${maxRetries + 1} attempts`, error);
          throw error;
        }
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(`[retry] ${label} attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error("unreachable");
  } catch (err) {
    success = false;
    throw err;
  } finally {
    if (_trackCallback) {
      try {
        _trackCallback(inferService(label), Date.now() - start, success);
      } catch {
        // tracking should never crash the main flow
      }
    }
  }
}
