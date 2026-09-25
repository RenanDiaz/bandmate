/**
 * Network helpers for offline downloads (spec §4.1, §9 #6). No Supabase here:
 * the service hands in a signed URL.
 */

/** A file that shows no progress (headers or body bytes) for this long is given up (§9 #6). */
export const FILE_STALL_TIMEOUT_MS = 60_000;

export type FileFetchFailure = "network" | "not-found" | "forbidden" | "unknown";

/** Thrown by fetchFileWithStallTimeout; `reason` is the per-file outcome (§5.4). */
export class FileFetchError extends Error {
  readonly reason: FileFetchFailure;
  readonly status: number | null;
  constructor(reason: FileFetchFailure, message: string, status: number | null = null) {
    super(message);
    this.name = "FileFetchError";
    this.reason = reason;
    this.status = status;
  }
}

/** §5.4: 404 (and storage's 400 "not found") → not-found, 401/403 → forbidden, 0/5xx → network. */
export function classifyHttpStatus(status: number): FileFetchFailure {
  if (status === 404) return "not-found";
  if (status === 401 || status === 403) return "forbidden";
  if (status === 0 || status === 408 || status === 429 || status >= 500) return "network";
  return "unknown";
}

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

export interface FetchFileOptions {
  /** Aborts the request; the call rejects with an AbortError-named error. */
  signal: AbortSignal;
  stallTimeoutMs?: number;
  /** Bytes received so far, after each chunk. */
  onBytes?: (received: number) => void;
  /** Called once headers arrive with Content-Length (or null); return false to stop before reading the body. */
  onLength?: (length: number | null) => boolean;
  fetchImpl?: typeof fetch;
}

/**
 * GETs `url` and returns the body as a PDF Blob. Each wait (headers, every
 * body chunk) is bounded by `stallTimeoutMs` of no progress, not by a total
 * time, so a slow but moving 50 MB download is never cut. A stall rejects with
 * FileFetchError("network"); an abort rejects with an AbortError; a
 * `onLength` veto resolves null.
 */
export async function fetchFileWithStallTimeout(url: string, opts: FetchFileOptions): Promise<Blob | null> {
  const stallMs = opts.stallTimeoutMs ?? FILE_STALL_TIMEOUT_MS;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  if (opts.signal.aborted) throw abortError();
  opts.signal.addEventListener("abort", onOuterAbort);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectStall: ((e: Error) => void) | null = null;
  const stalled = new Promise<never>((_, reject) => {
    rejectStall = reject;
  });
  // Never left unhandled: it is only ever awaited through Promise.race.
  stalled.catch(() => undefined);
  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      controller.abort();
      rejectStall?.(new FileFetchError("network", `No progress for ${stallMs} ms`));
    }, stallMs);
  };
  const aborted = new Promise<never>((_, reject) => {
    if (opts.signal.aborted) reject(abortError());
    opts.signal.addEventListener("abort", () => reject(abortError()));
  });
  aborted.catch(() => undefined);

  try {
    arm();
    let response: Response;
    try {
      response = await Promise.race([fetchImpl(url, { signal: controller.signal }), stalled, aborted]);
    } catch (error) {
      if (opts.signal.aborted) throw abortError();
      if (error instanceof FileFetchError) throw error;
      throw new FileFetchError("network", error instanceof Error ? error.message : String(error));
    }

    if (!response.ok) {
      // Drop the body so the connection is released.
      response.body?.cancel().catch(() => undefined);
      throw new FileFetchError(classifyHttpStatus(response.status), `HTTP ${response.status}`, response.status);
    }

    const lengthHeader = response.headers.get("content-length");
    const parsedLength = lengthHeader !== null ? Number(lengthHeader) : NaN;
    const length = Number.isFinite(parsedLength) && parsedLength >= 0 ? parsedLength : null;
    if (opts.onLength && opts.onLength(length) === false) {
      response.body?.cancel().catch(() => undefined);
      return null;
    }

    const type = "application/pdf";
    if (!response.body) {
      // No stream support: one wait for the whole body, still bounded.
      arm();
      const blob = await Promise.race([response.blob(), stalled, aborted]);
      opts.onBytes?.(blob.size);
      return blob.type === type ? blob : new Blob([blob], { type });
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    try {
      for (;;) {
        arm();
        const { done, value } = await Promise.race([reader.read(), stalled, aborted]);
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          opts.onBytes?.(received);
        }
      }
    } catch (error) {
      reader.cancel().catch(() => undefined);
      if (opts.signal.aborted) throw abortError();
      if (error instanceof FileFetchError) throw error;
      throw new FileFetchError("network", error instanceof Error ? error.message : String(error));
    }
    return new Blob(chunks as BlobPart[], { type });
  } finally {
    if (timer) clearTimeout(timer);
    opts.signal.removeEventListener("abort", onOuterAbort);
  }
}

/** Runs `fn` over `items` with at most `limit` in flight; results keep input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
