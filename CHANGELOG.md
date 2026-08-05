# Changelog

All notable changes to this project will be documented in this file.

## v0.1.0 (2026-08-05)

### Added
- `parseAcceptEncoding(header)` — parses HTTP `Accept-Encoding` request headers into frozen `AcceptEncodingEntry` objects, sorted by q-value descending. Handles q-values (RFC 9110 §12.5.3), encoding parameters (e.g. `br;level=4`), case normalization, wildcard (`*`), and `identity`.
- `selectEncoding(headerOrEntries, available)` — selects the best encoding from server-supported encodings given a client's `Accept-Encoding` header. Accepts raw header string or pre-parsed entries array.
- `serializeAcceptEncoding(entries)` — round-trips parsed entries back to a canonical header string.
- `AcceptEncodingEntry` class — frozen entry with `encoding`, `q`, `params`, `original`, `order` fields. Implements `.equals()`, `.repr()`, `.toJSON()`, and Node.js `util.inspect` support.
- `InvalidAcceptEncodingHeader` error class — thrown on malformed q-values (non-numeric, out of [0,1] range), invalid token characters, or empty encoding tokens.
- Full TypeScript `index.d.ts` declarations.
- 54 tests covering all 27 acceptance criteria plus edge/boundary cases.
