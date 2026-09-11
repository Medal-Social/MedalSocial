/** Successful API response wrapper */
export interface ApiResponse<T> {
  data: T;
}

/** Paginated API response */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    has_more: boolean;
    next_cursor: string | null;
  };
}

/**
 * Base class for every failure this SDK throws.
 *
 * A call can fail three ways: the API answered with an error status
 * ({@link MedalApiError}), the deadline elapsed ({@link MedalTimeoutError}), or
 * the request never reached Medal at all ({@link MedalNetworkError}). The last
 * two used to surface as a raw `AbortError` / `TypeError` from `fetch`, so
 * `catch (e) { if (e instanceof MedalApiError) … }` silently skipped the two
 * most common operational failures. Narrow on this to cover all three, then on
 * `code` (or `instanceof MedalApiError`) to tell them apart.
 */
export class MedalError extends Error {
  /** Machine-readable failure code — the API's `error.code`, or `TIMEOUT` / `NETWORK`. */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MedalError";
    this.code = code;
  }
}

/** Transport-level facts about the response that failed. */
export interface MedalApiErrorMeta {
  /**
   * The `X-Request-ID` header of the failing response. Every Medal API
   * response carries one; quote it to support and the exact request can be
   * found in Medal's logs. `null` when the response carried no header (a
   * proxy error page, say).
   */
  requestId?: string | null;
  /**
   * The response's `Retry-After`, in milliseconds. Set on `429` and on the
   * `503`s that name a retry window; `null` when the header was absent or
   * unparseable. Both wire forms are understood — delay-seconds and HTTP-date.
   */
  retryAfterMs?: number | null;
}

/** API error thrown by the client */
export class MedalApiError extends MedalError {
  readonly status: number;
  readonly details?: unknown;
  /** See {@link MedalApiErrorMeta.requestId}. */
  readonly requestId: string | null;
  /** See {@link MedalApiErrorMeta.retryAfterMs}. */
  readonly retryAfterMs: number | null;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    meta?: MedalApiErrorMeta,
  ) {
    super(code, message);
    this.name = "MedalApiError";
    this.status = status;
    this.details = details;
    this.requestId = meta?.requestId ?? null;
    this.retryAfterMs = meta?.retryAfterMs ?? null;
  }
}

/**
 * The per-attempt deadline (`timeout`, default 30 s) elapsed before the
 * response body was in hand.
 *
 * Distinct from a caller's own `AbortSignal`: cancelling through that rejects
 * with the abort reason you supplied, unchanged, because "the user navigated
 * away" is not a Medal failure and must not be reported as one.
 */
export class MedalTimeoutError extends MedalError {
  declare readonly code: "TIMEOUT";
  /** The budget that elapsed, in milliseconds. */
  readonly timeoutMs: number;

  constructor(timeoutMs: number, message = `Request timed out after ${timeoutMs}ms`) {
    super("TIMEOUT", message);
    this.name = "MedalTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/**
 * The request never produced a response: DNS failure, TLS failure, connection
 * reset, offline browser. `fetch` reports all of these as a bare `TypeError`,
 * which says nothing about whether the write happened — for a keyed write the
 * SDK retries first (the key makes the retry a replay), and only a failure
 * that outlives the retries reaches you here.
 */
export class MedalNetworkError extends MedalError {
  declare readonly code: "NETWORK";

  constructor(message: string, options?: { cause?: unknown }) {
    super("NETWORK", message);
    this.name = "MedalNetworkError";
    if (options && "cause" in options) {
      this.cause = options.cause;
    }
  }
}

/** Pagination options for list endpoints */
export interface PaginationOptions {
  limit?: number;
  cursor?: string;
}

/**
 * A timestamp on the way IN to a list filter: Unix milliseconds, or an ISO
 * 8601 date-time string. The API normalises both to milliseconds; anything
 * else is a `400 VALIDATION_ERROR`.
 */
export type TimestampInput = number | string;
