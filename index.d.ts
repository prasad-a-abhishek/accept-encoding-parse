/**
 * Zero-dependency parser and serializer for HTTP Accept-Encoding request
 * headers. Implements RFC 9110 §12.5.3 with q-value sorting and encoding
 * parameters.
 *
 * @example
 * import { parseAcceptEncoding, selectEncoding } from 'accept-encoding-parse';
 * const entries = parseAcceptEncoding('gzip, br;q=0.8, identity;q=0.1');
 * // entries[0].encoding === 'gzip'
 * // entries[1].encoding === 'br'
 * // entries[2].encoding === 'identity'
 */

/**
 * Thrown when an Accept-Encoding header value violates RFC 9110 §12.5.3.
 */
export class InvalidAcceptEncodingHeader extends Error {
  constructor(message: string);
  name: 'InvalidAcceptEncodingHeader';
}

/**
 * Frozen structured representation of one Accept-Encoding entry.
 * Returned by parseAcceptEncoding. All fields are read-only.
 */
export class AcceptEncodingEntry {
  /** Lower-cased encoding token (e.g. "gzip", "br", "*", "identity") */
  readonly encoding: string;
  /** Quality value in [0, 1], default 1.0 */
  readonly q: number;
  /** True iff the header carried an explicit ;q=... value */
  readonly explicitQ: boolean;
  /** Encoding parameters (e.g. {level: "4"}). Frozen. */
  readonly params: Readonly<Record<string, string>>;
  /** Original substring from the header (trimmed) */
  readonly original: string;
  /** Zero-based original position in the header (pre-sort) */
  readonly order: number;

  constructor(init: {
    encoding: string;
    q: number;
    params?: Record<string, string>;
    original?: string;
    order?: number;
    explicitQ?: boolean;
  });

  /** Structural equality check. */
  equals(other: AcceptEncodingEntry | null | undefined): boolean;

  /** Human-readable representation. */
  toString(): string;

  /** Spec's `repr` — calls toString. */
  repr(): string;

  /** JSON round-trip helper. */
  toJSON(): { encoding: string; q: number; params: Record<string, string> };
}

/**
 * Parse an HTTP Accept-Encoding header value into a frozen array of
 * AcceptEncodingEntry objects, sorted by q-value descending.
 *
 * Empty string returns `[identity]` per RFC 9110 §12.5.3. Throws
 * InvalidAcceptEncodingHeader on malformed input.
 *
 * @param header — the raw Accept-Encoding header value
 */
export function parseAcceptEncoding(header: string): readonly AcceptEncodingEntry[];

/**
 * Serialize an array of AcceptEncodingEntry objects back to an
 * Accept-Encoding header string. Order is preserved as given;
 * q=1.0 is omitted per RFC 9110 canonical form.
 *
 * @param entries
 */
export function serializeAcceptEncoding(entries: readonly AcceptEncodingEntry[]): string;

/**
 * Select the best encoding from `available` given the client's Accept-Encoding
 * header. Returns the highest-q available encoding the client explicitly
 * mentions (or that matches `*`), or `null` if nothing matches.
 *
 * @param headerOrEntries — header string or pre-parsed entries array
 * @param available — server-supported encodings (case-insensitive)
 */
export function selectEncoding(
  headerOrEntries: string | readonly AcceptEncodingEntry[],
  available: readonly string[]
): string | null;
