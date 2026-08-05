'use strict';

/**
 * accept-encoding-parse — Zero-dependency parser for HTTP Accept-Encoding request headers
 * RFC 9110 §12.5.3: https://www.rfc-editor.org/rfc/rfc9110#section-12.5.3
 */

'use strict';

/**
 * Custom error thrown when an Accept-Encoding header fails to parse.
 * @class
 */
class InvalidAcceptEncodingHeader extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidAcceptEncodingHeader';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidAcceptEncodingHeader);
    }
  }
}

/**
 * Frozen structured representation of one Accept-Encoding entry.
 *
 * @typedef {Object} AcceptEncodingEntry
 * @property {string} encoding - Lower-cased coding token (e.g. "gzip", "br", "*", "identity")
 * @property {number} q - Quality value in [0, 1], default 1.0
 * @property {boolean} explicitQ - True iff the header carried an explicit ;q=... value
 * @property {Readonly<Record<string, string>>} params - Encoding parameters except q (e.g. {level: "4"})
 * @property {string} original - The original substring from the header (trimmed)
 * @property {number} order - Zero-based original position in the header (pre-sort)
 */
class AcceptEncodingEntry {
  /**
   * @param {{ encoding: string, q: number, params: Record<string,string>, original: string, order: number, explicitQ?: boolean }} init
   */
  constructor({ encoding, q, params, original, order, explicitQ = false }) {
    const frozenParams = Object.freeze({ ...params });
    Object.defineProperties(this, {
      encoding: { value: encoding, enumerable: true, writable: false, configurable: false },
      q: { value: q, enumerable: true, writable: false, configurable: false },
      explicitQ: { value: explicitQ, enumerable: true, writable: false, configurable: false },
      params: { value: frozenParams, enumerable: true, writable: false, configurable: false },
      original: { value: original, enumerable: true, writable: false, configurable: false },
      order: { value: order, enumerable: true, writable: false, configurable: false },
    });
    Object.freeze(this);
  }

  /**
   * Two entries are equal iff encoding, q, and params match (params order-independent).
   * @param {AcceptEncodingEntry | null | undefined} other
   * @returns {boolean}
   */
  equals(other) {
    if (other == null) return false;
    if (!(other instanceof AcceptEncodingEntry)) return false;
    if (this.encoding !== other.encoding) return false;
    if (this.q !== other.q) return false;
    const ak = Object.keys(this.params);
    const bk = Object.keys(other.params);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!Object.prototype.hasOwnProperty.call(other.params, k)) return false;
      if (other.params[k] !== this.params[k]) return false;
    }
    return true;
  }

  /**
   * Node.js inspect helper. Includes encoding, q, and params.
   * @returns {string}
   */
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `AcceptEncodingEntry { encoding: '${this.encoding}', q: ${this.q}, params: ${JSON.stringify(this.params)} }`;
  }

  /**
   * Spec calls it `repr` — included for spec compliance.
   * @returns {string}
   */
  repr() {
    return this[Symbol.for('nodejs.util.inspect.custom')]();
  }

  /**
   * Custom JSON serialization so the entry round-trips through JSON intact.
   * @returns {{encoding: string, q: number, params: Record<string,string>}}
   */
  toJSON() {
    return { encoding: this.encoding, q: this.q, params: { ...this.params } };
  }
}

/**
 * Parse a qvalue string (RFC 9110 §12.5.3 + §12.4.2):
 *   qvalue = ( "0" [ "." 3DIGIT ] ) / ( "1" [ "." 3*DIGIT ] )
 *
 * @param {string} raw
 * @returns {number}
 * @throws {InvalidAcceptEncodingHeader}
 */
function parseQValue(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new InvalidAcceptEncodingHeader(`Invalid qvalue: ${JSON.stringify(raw)}`);
  }
  // Accept: 0, 1, 0.x (1-3 digits), 1.0...1.000
  if (!/^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?|1)$/.test(raw)) {
    throw new InvalidAcceptEncodingHeader(`Invalid q-value '${raw}'`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new InvalidAcceptEncodingHeader(`q-value '${raw}' out of range [0,1]`);
  }
  return value;
}

/**
 * Tokenize a single coding element (the chunk between commas).
 * @param {string} segment
 * @returns {{ encoding: string, q: number, params: Record<string,string>, original: string }}
 * @throws {InvalidAcceptEncodingHeader}
 */
function parseSegment(segment) {
  const trimmed = segment.replace(/^\s+|\s+$/g, '');
  if (trimmed.length === 0) {
    throw new InvalidAcceptEncodingHeader(`Empty Accept-Encoding segment`);
  }

  const parts = trimmed.split(';');
  const encodingRaw = parts.shift();
  if (!encodingRaw || encodingRaw.length === 0) {
    throw new InvalidAcceptEncodingHeader(`Missing encoding token`);
  }
  // RFC 9110 token characters
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(encodingRaw)) {
    throw new InvalidAcceptEncodingHeader(`Invalid encoding token '${encodingRaw}'`);
  }
  const encoding = encodingRaw.toLowerCase();

  const params = {};
  let q = 1.0;
  let explicitQ = false;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].replace(/^\s+|\s+$/g, '');
    if (p.length === 0) {
      // Empty segment after ';' (e.g. "gzip;") — reject per RFC 9110 §12.5.3
      throw new InvalidAcceptEncodingHeader(`Empty parameter segment in '${trimmed}'`);
    }
    const eq = p.indexOf('=');
    if (eq < 0) {
      // bare param (no value) — reject per RFC 9110 §12.5.3 (only q takes bare params)
      throw new InvalidAcceptEncodingHeader(`Parameter without '=': '${p}'`);
    }
    const name = p.slice(0, eq).replace(/\s+$/, '').toLowerCase();
    const value = p.slice(eq + 1).replace(/^\s+/, '');
    if (name.length === 0) {
      throw new InvalidAcceptEncodingHeader(`Empty parameter name`);
    }
    if (value.length === 0) {
      throw new InvalidAcceptEncodingHeader(`Empty value for parameter '${name}'`);
    }
    if (name === 'q') {
      q = parseQValue(value);
      explicitQ = true;
    } else {
      params[name] = value;
    }
  }
  return { encoding, q, params, original: trimmed, explicitQ };
}

/**
 * Parse an Accept-Encoding header value into structured entries, sorted by q-value descending.
 * Stable secondary sort: ties on q preserve original header order.
 * @param {string} header
 * @returns {AcceptEncodingEntry[]}
 * @throws {InvalidAcceptEncodingHeader}
 */
function parseAcceptEncoding(header) {
  if (typeof header !== 'string') {
    throw new InvalidAcceptEncodingHeader(
      `Accept-Encoding header must be a string, got ${typeof header}`
    );
  }
  if (header.length === 0) {
    return Object.freeze([
      new AcceptEncodingEntry({
        encoding: 'identity', q: 1.0, params: {}, original: '', order: 0,
      }),
    ]);
  }

  const rawSegments = header.split(',');
  const entries = [];
  rawSegments.forEach((segment, order) => {
    const trimmed = segment.replace(/^\s+|\s+$/g, '');
    if (trimmed.length === 0) return; // skip empty segments (trailing comma, etc.)
    const parsed = parseSegment(trimmed);
    entries.push(
      new AcceptEncodingEntry({ ...parsed, order })
    );
  });

  if (entries.length === 0) {
    return Object.freeze([
      new AcceptEncodingEntry({
        encoding: 'identity', q: 1.0, params: {}, original: '', order: 0,
      }),
    ]);
  }

  // Sort by q descending, stable on original order for ties
  entries.sort((a, b) => {
    if (b.q !== a.q) return b.q - a.q;
    return a.order - b.order;
  });

  return Object.freeze(entries);
}

/**
 * Serialize entries back into a canonical Accept-Encoding header string.
 * @param {AcceptEncodingEntry[]} entries
 * @returns {string}
 * @throws {InvalidAcceptEncodingHeader}
 */
function serializeAcceptEncoding(entries) {
  if (!Array.isArray(entries)) {
    throw new InvalidAcceptEncodingHeader(
      `serializeAcceptEncoding requires an array, got ${typeof entries}`
    );
  }
  const parts = [];
  for (const entry of entries) {
    if (!(entry instanceof AcceptEncodingEntry)) {
      throw new InvalidAcceptEncodingHeader(
        `serializeAcceptEncoding: not an AcceptEncodingEntry`
      );
    }
    const pieces = [entry.encoding];
    // Omit q=1.0 per RFC 9110 canonical form
    if (entry.q !== 1.0) {
      let qStr = entry.q.toFixed(3);
      qStr = qStr.replace(/0+$/, '').replace(/\.$/, '');
      pieces.push(`q=${qStr}`);
    }
    for (const [k, v] of Object.entries(entry.params)) {
      pieces.push(`${k}=${v}`);
    }
    parts.push(pieces.join(';'));
  }
  return parts.join(', ');
}

/**
 * Pick the best encoding the server supports given an Accept-Encoding header.
 * Accepts either an already-parsed entries array or a raw header string.
 * @param {string | AcceptEncodingEntry[]} headerOrEntries
 * @param {ReadonlyArray<string>} available
 * @returns {string | null}
 */
function selectEncoding(headerOrEntries, available) {
  if (!Array.isArray(available)) {
    throw new InvalidAcceptEncodingHeader(
      `selectEncoding: available must be an array`
    );
  }

  /** @type {AcceptEncodingEntry[]} */
  let entries;
  if (typeof headerOrEntries === 'string') {
    entries = parseAcceptEncoding(headerOrEntries);
  } else if (Array.isArray(headerOrEntries)) {
    entries = headerOrEntries;
  } else {
    throw new InvalidAcceptEncodingHeader(
      `selectEncoding: headerOrEntries must be a string or entries array`
    );
  }

  const normAvailable = available.map((a) => String(a).toLowerCase());

  // Empty-header sentinel: synthetic identity entry (order=0, original='')
  if (
    entries.length === 1 &&
    entries[0].encoding === 'identity' &&
    entries[0].order === 0 &&
    entries[0].original === ''
  ) {
    // Return 'identity' for empty header — AC-17 and RFC 9110 implicit identity
    return 'identity';
  }

  // Build effective q for each candidate
  const explicit = new Map(); // encoding -> { q, order }
  let hasWildcard = false;
  let wildcardQ = 0;
  let identityExplicit = null; // { q, order } if identity was explicitly listed

  for (const e of entries) {
    if (e.encoding === '*') {
      hasWildcard = true;
      if (e.q > wildcardQ) wildcardQ = e.q;
      continue;
    }
    if (e.encoding === 'identity') {
      identityExplicit = { q: e.q, order: e.order };
      continue;
    }
    if (e.q === 0) continue; // explicitly rejected
    if (!explicit.has(e.encoding) || e.q > explicit.get(e.encoding).q) {
      explicit.set(e.encoding, { q: e.q, order: e.order });
    }
  }

  // Identity: use explicit q if listed (even 0 = reject), else RFC default (q=1.0)
  const identityQ = identityExplicit ? identityExplicit.q : 1.0;
  const identityOrder = identityExplicit ? identityExplicit.order : Infinity;

  // Pick highest-q candidate that is in available
  let best = null;
  let bestQ = -Infinity;
  let bestOrder = Infinity;

  for (const av of normAvailable) {
    let entryQ = null;
    let entryOrder = Infinity;
    if (av === 'identity') {
      // identity gets its explicit q (possibly 0) or RFC default 1.0
      entryQ = identityQ;
      entryOrder = identityOrder;
    } else if (explicit.has(av)) {
      entryQ = explicit.get(av).q;
      entryOrder = explicit.get(av).order;
    } else if (hasWildcard) {
      entryQ = wildcardQ;
      entryOrder = Infinity;
    }
    if (entryQ !== null && entryQ > 0 && entryQ > bestQ) {
      best = av;
      bestQ = entryQ;
      bestOrder = entryOrder;
    } else if (entryQ !== null && entryQ > 0 && entryQ === bestQ && entryOrder < bestOrder) {
      best = av;
      bestOrder = entryOrder;
    }
  }

  return best;
}

module.exports = {
  parseAcceptEncoding,
  serializeAcceptEncoding,
  selectEncoding,
  AcceptEncodingEntry,
  InvalidAcceptEncodingHeader,
};
