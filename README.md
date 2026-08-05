# accept-encoding-parse

> Zero-dependency Node.js parser for HTTP `Accept-Encoding` request headers with q-value and encoding-parameter support (RFC 9110 §12.5.3).

## Install

```bash
npm install accept-encoding-parse
```

## Test

```bash
npm test
```

## Usage

```js
const {
  parseAcceptEncoding,
  serializeAcceptEncoding,
  selectEncoding,
  AcceptEncodingEntry,
  InvalidAcceptEncodingHeader,
} = require('accept-encoding-parse');
```

### `parseAcceptEncoding(header)`

Parses an `Accept-Encoding` header value into an array of frozen `AcceptEncodingEntry` objects, sorted by q-value descending (highest preference first).

```js
parseAcceptEncoding('gzip, deflate, br')
// → [
//     AcceptEncodingEntry { encoding: 'gzip', q: 1, params: {} },
//     AcceptEncodingEntry { encoding: 'deflate', q: 1, params: {} },
//     AcceptEncodingEntry { encoding: 'br', q: 1, params: {} }
//   ]

parseAcceptEncoding('gzip;q=0.5, br;q=1.0, deflate')
// → [
//     AcceptEncodingEntry { encoding: 'br', q: 1, params: {} },
//     AcceptEncodingEntry { encoding: 'deflate', q: 1, params: {} },
//     AcceptEncodingEntry { encoding: 'gzip', q: 0.5, params: {} }
//   ]

parseAcceptEncoding('br;level=4')
// → [AcceptEncodingEntry { encoding: 'br', q: 1, params: { level: '4' } }]

parseAcceptEncoding('') // empty header → implicit identity per RFC 9110
// → [AcceptEncodingEntry { encoding: 'identity', q: 1, params: {} }]
```

### `selectEncoding(headerOrEntries, available)`

Selects the best encoding the server supports, given the client's `Accept-Encoding` header. Accepts either a raw header string or a pre-parsed entries array.

```js
// Returns the highest-q encoding the server supports
selectEncoding('gzip;q=0.5, br;q=1.0', ['gzip', 'br', 'deflate'])
// → 'br'

// Returns null when no match is acceptable
selectEncoding('gzip;q=0', ['gzip', 'deflate'])
// → null

// Empty header → 'identity' fallback
selectEncoding('', ['gzip'])
// → 'identity'
```

### `serializeAcceptEncoding(entries)`

Round-trips parsed entries back to a canonical header string. Q-values of exactly `1.0` are omitted per RFC 9110.

```js
serializeAcceptEncoding([
  { encoding: 'br', q: 1, params: { level: '4' } },
  { encoding: 'gzip', q: 0.5, params: {} },
])
// → 'br;level=4;q=1, gzip;q=0.5'
```

### `AcceptEncodingEntry`

Frozen object with `encoding`, `q`, `params`, `original`, and `order` fields. Implements `.equals(other)`, `.repr()`, `.toJSON()`, and Node.js `util.inspect` support.

```js
const entry = parseAcceptEncoding('br;level=4')[0];
entry.encoding      // 'br'
entry.q             // 1
entry.params.level  // '4'
Object.isFrozen(entry)  // true
```

### `InvalidAcceptEncodingHeader`

Thrown on malformed headers (e.g., q-value out of range, invalid token characters).

```js
try {
  parseAcceptEncoding('gzip;q=1.5');
} catch (err) {
  err.name   // 'InvalidAcceptEncodingHeader'
  err.message // "q-value '1.5' out of range [0,1]"
}
```

## API

| Export | Signature | Description |
|---|---|---|
| `parseAcceptEncoding` | `(header: string): AcceptEncodingEntry[]` | Parse header into sorted entries |
| `serializeAcceptEncoding` | `(entries: AcceptEncodingEntry[]): string` | Serialize entries to string |
| `selectEncoding` | `(headerOrEntries: string \| AcceptEncodingEntry[], available: string[]): string \| null` | Pick best available encoding |
| `AcceptEncodingEntry` | `class` | Frozen entry with `encoding`, `q`, `params`, `original`, `order` |
| `InvalidAcceptEncodingHeader` | `class extends Error` | Thrown on parse errors |

## Limitations / Non-Goals

- **No compression/decompression** — this library only parses headers; it does not compress or decompress data.
- **No `Content-Encoding` / `Transfer-Encoding`** — these are response-side headers; this library handles the request-side `Accept-Encoding` only.
- **No `Accept` / `Accept-Language` / `Accept-Charset`** — those are separate RFC 9111/RFC 7231 headers with different grammars. Use a dedicated library for each.
- **No async or streaming variants** — synchronous parsing only, suitable for request-context header values.
- **No framework integrations** — Express, Fastify, Hono, etc. integrations are out of scope; the library is framework-agnostic.

## References

- [RFC 9110 §12.5.3 — Accept-Encoding](https://www.rfc-editor.org/rfc/rfc9110#section-12.5.3)
- [RFC 9110 §12.4.2 — Weight](https://www.rfc-editor.org/rfc/rfc9110#section-12.4.2)
- [RFC 9110 §5.6.2 — Token](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.2)
