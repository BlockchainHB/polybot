export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, label = "operation" } = opts;

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
}
