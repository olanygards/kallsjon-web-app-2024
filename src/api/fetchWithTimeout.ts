/**
 * Fetch med timeout, retry och ETag-stöd
 */

interface FetchWithTimeoutOptions extends RequestInit {
  etag?: string | null;
}

export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {},
  timeoutMs: number = 6000,
  retries: number = 1
): Promise<Response> {
  let attempt = 0;
  const { etag, ...fetchOptions } = options;

  while (true) {
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      // Lägg till ETag-header om vi har en
      const headers = new Headers(fetchOptions.headers || {});
      if (etag) {
        headers.set('If-None-Match', etag);
      }

      const res = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: ctrl.signal
      });

      clearTimeout(timeoutId);

      // Om 5xx-fel och vi har retries kvar, försök igen
      if (!res.ok && res.status >= 500 && attempt < retries) {
        throw new Error(`HTTP ${res.status}`);
      }

      return res;
    } catch (err) {
      clearTimeout(timeoutId);

      // Om vi har retries kvar, försök igen
      if (attempt++ >= retries) {
        throw err;
      }

      // Exponential backoff med jitter
      const backoff = Math.min(2000, 300 * Math.pow(2, attempt - 1)) + Math.random() * 100;
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
}

