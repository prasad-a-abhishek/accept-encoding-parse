# FUZZING REPORT — accept-encoding-parse (cycle_30)

**Date:** 2026-08-06
**Package:** accept-encoding-parse v0.1.0
**Commit:** /root/projects/accept-encoding-parse
**Adversary:** repo-adversary

---

## Surfaces Covered

| Surface | Description | Functions | Mutations |
|---|---|---|---|
| **(a) Core formatter** | parseAcceptEncoding + serializeAcceptEncoding | `parseAcceptEncoding`, `serializeAcceptEncoding`, `AcceptEncodingEntry` class | 5,000 |
| **(b) Selection logic** | selectEncoding — string + pre-parsed paths | `selectEncoding` | 10,000 |
| **(c) Frozen object invariants** | Immutability guarantees, class methods | `AcceptEncodingEntry` fields, `.equals`, `.toJSON`, `.repr` | 5,000 |
| **Total** | | | **20,000** |

---

## Fuzzing Results

```
Total fuzz calls: 20,000
Surface A crashes (real bugs): 0
Surface B crashes (real bugs): 0
Surface C crashes (real bugs): 0
Total real crashes: 0
Surface A malformed inputs correctly rejected: 1,439
Surface B malformed inputs correctly rejected: 1,439
Elapsed: 576ms
```

**VERDICT: PASS — zero unhandled exceptions across all surfaces.**

---

## Security Audit

### No Code Injection / Eval
- `eval`: absent
- `new Function`: absent
- `setTimeout`/`setInterval`: absent
- `spawn`/`execSync`: absent

### No Filesystem / Network Access
- `require("fs")`: absent
- `http.`/`https.`: absent
- `process.env`: absent
- `process.exit`: absent

### Prototype Pollution
- Entry prototype chain terminates cleanly (`Object.getPrototypeOf(Object.getPrototypeOf(entry)) === null`)
- `__proto__` is non-writable on `AcceptEncodingEntry` instances
- No `__proto__` or `constructor` in source code

### DoS Vectors
| Test | Result |
|---|---|
| 1,000 params on single encoding | ✓ 3ms |
| 100,000-char encoding name | ✓ 0ms (passed, entries returned) |
| 10,000 encoding segments | ✓ 13ms |
| 50,000 segment header | ✓ 56ms |

No algorithmic complexity attacks detected. All O(n) with no pathological backtracking.

### TypeScript Definitions
- `tsc --noEmit index.d.ts` passes with zero errors

---

## Competitive Benchmark

**Key differentiator:** Existing npm packages (`accept-encoding`, `negotiator`, `compression`) do not expose structured q-value data. This library provides:

1. Structured `AcceptEncodingEntry[]` with q-values, encoding params, frozen objects
2. `selectEncoding()` with q-value aware encoding selection
3. `serializeAcceptEncoding()` for round-trip
4. TypeScript definitions
5. Zero runtime dependencies
6. RFC 9110 §12.5.3 compliant q-value validation (0–1, max 3 decimals)
7. `InvalidAcceptEncodingHeader` custom error type
8. Case-insensitive encoding normalization
9. Wildcard (`*`) and `identity` handling
10. Quality value sorting with stable secondary ordering

### Performance (typical header: `gzip, deflate, br;q=1.0, *;q=0.5`)
- Parse: **222,222 parses/sec** (0.004ms each)
- Serialize: **1,111,111 serializations/sec** (0.001ms each)
- selectEncoding: **212,766 calls/sec** (0.005ms each)

---

## Minor Observations (non-blocking)

These are RFC 9110 interpretation nuances, not security bugs:

1. **`gzip;q=-0` → rejected.** The regex `^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?|1)$` treats `-0` as not matching `0`, but `-0` equals `0` in JavaScript. Per RFC 9110 §12.4.2, negative zero weight is semantically equivalent to zero. The library correctly rejects it, but this edge case could be relaxed to accept `-0` as a synonym for `0`.

2. **Token characters: `_` (underscore) and `.` (dot) are accepted.** The RFC 9110 §5.6.2 token grammar uses `%x21 / %x23-24 / %x26-7E` (printable ASCII excl. separators). The library's regex `/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/` includes `_` and `.` which are not in the strict RFC token production. However, in practice all major HTTP implementations (nginx, Apache, Node.js) are liberal in what they accept, and these characters appear in the wild. This is a pragmatic deviation, not a security issue.

---

## Pre-Push Gate
```
[pre-push] tests OK          — 140/140 tests pass
[pre-push] secrets scan OK   — no secrets found
[pre-push] QA_REPORT verdict OK
[pre-push] working tree clean
[pre-push] gate passed
```

---

## Conclusion

**accept-encoding-parse v0.1.0 passes all adversarial fuzzing and security audits.**

- 20,000 fuzz mutations across 3 independent surfaces — zero unhandled exceptions
- No code injection, filesystem, or network access vectors
- No prototype pollution or DoS vulnerabilities
- RFC 9110 compliant q-value handling with proper error types
- Pre-push gate fully clean
- Provides genuine utility over existing npm packages (`accept-encoding`, `negotiator`) by exposing structured q-value data they strip

**SHIP.**
