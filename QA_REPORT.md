# QA Report — accept-encoding-parse

## Scope

- Spec: RFC 9110 §12.5.3 Accept-Encoding header parser with q-value sorting
- Repo: `/root/projects/accept-encoding-parse`
- Tests: 140 test cases (27 acceptance criteria plus extended edge-case coverage)

## Verification Performed

### Functional tests (140/140 pass)
```
npm test → # pass 140, # fail 0
```

Covers parsing, serialization, selection, q-value boundaries, parameters, token validation, sort stability, equality, JSON serialization, and repeated/concurrent calls.

### TypeScript declarations
```
npx --yes tsc --noEmit index.d.ts → exit 0
```

### Security scan
No secrets, tokens, or credentials found in tracked source, tests, or documentation.

### Zero runtime dependencies
```
package.json → "dependencies": {}
npm install --dry-run → no runtime dependencies
```

### Fresh-clone smoke
A depth-1 clone was installed in a temporary directory and its full test suite passed.

### Pre-push gate
```
scripts/pre-push-gate.sh → exit 0
```

All required gate checks passed: tests, secrets scan, QA verdict, and clean working tree.

## Findings

None.

## Limitations

- Quoted-string parameter values (for example, `br;desc="hello world"`) are not supported; the parser uses the documented token/value subset.
- Serialization emits canonical q-values and omits q=1.0, even when q=1.0 was explicit in the input.

VERDICT: SHIP
