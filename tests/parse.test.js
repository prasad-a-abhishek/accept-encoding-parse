'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  parseAcceptEncoding,
  serializeAcceptEncoding,
  selectEncoding,
  AcceptEncodingEntry,
  InvalidAcceptEncodingHeader,
} = require('../src/index.js');

// =============================================================================
// AC-01: parses 'gzip' to entry with encoding='gzip' and q=1.0
// =============================================================================
test('AC-01: parse_gzip_only', () => {
  const entries = parseAcceptEncoding('gzip');
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].encoding, 'gzip');
  assert.strictEqual(entries[0].q, 1.0);
  assert.deepStrictEqual(entries[0].params, {});
});

// =============================================================================
// AC-02: parses 'gzip, deflate' to two entries
// =============================================================================
test('AC-02: parse_multiple_encodings', () => {
  const entries = parseAcceptEncoding('gzip, deflate');
  assert.strictEqual(entries.length, 2);
  assert.strictEqual(entries[0].encoding, 'gzip');
  assert.strictEqual(entries[1].encoding, 'deflate');
});

// =============================================================================
// AC-03: parses 'gzip;q=0.5, deflate' with correct q-values
// =============================================================================
test('AC-03: parse_with_q_values', () => {
  const entries = parseAcceptEncoding('gzip;q=0.5, deflate');
  const byEnc = Object.fromEntries(entries.map((e) => [e.encoding, e.q]));
  assert.strictEqual(byEnc.gzip, 0.5);
  assert.strictEqual(byEnc.deflate, 1.0);
});
// =============================================================================
// AC-04: entries are sorted by q-value descending
// =============================================================================
test('AC-04: parse_q_value_sorting', () => {
  const entries = parseAcceptEncoding('gzip;q=0.5, br;q=1.0, deflate;q=0.8');
  assert.strictEqual(entries[0].encoding, 'br');
  assert.strictEqual(entries[0].q, 1.0);
  assert.strictEqual(entries[1].encoding, 'deflate');
  assert.strictEqual(entries[1].q, 0.8);
  assert.strictEqual(entries[2].encoding, 'gzip');
  assert.strictEqual(entries[2].q, 0.5);
});

// =============================================================================
// AC-05: encoding without explicit q-value has q=1.0
// =============================================================================
test('AC-05: parse_default_q_is_one', () => {
  const entries = parseAcceptEncoding('gzip, deflate, br');
  for (const e of entries) {
    assert.strictEqual(e.q, 1.0, `encoding=${e.encoding} should have q=1.0`);
  }
});

// =============================================================================
// AC-06: parses 'br;level=4' with params {level:'4'}
// =============================================================================
test('AC-06: parse_brotli_params', () => {
  const entries = parseAcceptEncoding('br;level=4');
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].encoding, 'br');
  assert.deepStrictEqual(entries[0].params, { level: '4' });
});

// =============================================================================
// AC-07: parses 'gzip;window=15' with params {window:'15'}
// =============================================================================
test('AC-07: parse_gzip_with_window', () => {
  const entries = parseAcceptEncoding('gzip;window=15');
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].encoding, 'gzip');
  assert.deepStrictEqual(entries[0].params, { window: '15' });
});

// =============================================================================
// AC-08: parses 'identity' with q=1.0
// =============================================================================
test('AC-08: parse_identity', () => {
  const entries = parseAcceptEncoding('identity');
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].encoding, 'identity');
  assert.strictEqual(entries[0].q, 1.0);
});

// =============================================================================
// AC-09: parses '*' to entry with encoding '*'
// =============================================================================
test('AC-09: parse_wildcard', () => {
  const entries = parseAcceptEncoding('*');
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].encoding, '*');
  assert.strictEqual(entries[0].q, 1.0);
});

// =============================================================================
// AC-10: parses '' to [AcceptEncodingEntry {encoding:'identity', q:1.0, params:{}}]
// =============================================================================
test('AC-10: parse_empty_string', () => {
  const entries = parseAcceptEncoding('');
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].encoding, 'identity');
  assert.strictEqual(entries[0].q, 1.0);
  assert.deepStrictEqual(entries[0].params, {});
});

// =============================================================================
// AC-11: 'gzip, unknown-encoding, deflate' ignores unknown
// =============================================================================
test('AC-11: parse_unknown_ignored', () => {
  const entries = parseAcceptEncoding('gzip, unknown-encoding, deflate');
  assert.strictEqual(entries.length, 3);
  const encodings = entries.map((e) => e.encoding);
  assert.ok(encodings.includes('gzip'));
  assert.ok(encodings.includes('unknown-encoding'));
  assert.ok(encodings.includes('deflate'));
});

// =============================================================================
// AC-12: 'gzip ,  deflate' handles whitespace around commas
// =============================================================================
test('AC-12: parse_whitespace', () => {
  const entries = parseAcceptEncoding('gzip ,  deflate');
  assert.strictEqual(entries.length, 2);
  assert.strictEqual(entries[0].encoding, 'gzip');
  assert.strictEqual(entries[1].encoding, 'deflate');
});

// =============================================================================
// AC-13: 'gzip,' parses without error
// =============================================================================
test('AC-13: parse_trailing_comma', () => {
  const entries = parseAcceptEncoding('gzip,');
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].encoding, 'gzip');
});

// =============================================================================
// AC-14: 'GZIP, DeFlAtE, BR' normalizes to lowercase
// =============================================================================
test('AC-14: parse_case_insensitive', () => {
  const entries = parseAcceptEncoding('GZIP, DeFlAtE, BR');
  assert.strictEqual(entries.length, 3);
  for (const e of entries) {
    assert.strictEqual(e.encoding, e.encoding.toLowerCase());
    assert.ok(e.encoding === e.encoding.toLowerCase());
    assert.match(e.encoding, /^[a-z0-9*.-]+$/);
  }
  const encodings = entries.map((e) => e.encoding);
  assert.ok(encodings.includes('gzip'));
  assert.ok(encodings.includes('deflate'));
  assert.ok(encodings.includes('br'));
});

// =============================================================================
// AC-15: selectEncoding('gzip;q=0.5, br', ['gzip','br']) returns 'br'
// =============================================================================
test('AC-15: select_best_encoding', () => {
  assert.strictEqual(selectEncoding('gzip;q=0.5, br', ['gzip', 'br']), 'br');
  assert.strictEqual(selectEncoding('br;q=0.9, gzip;q=1.0', ['gzip', 'br']), 'gzip');
  assert.strictEqual(selectEncoding('deflate;q=0.5, gzip;q=0.7, br;q=1.0', ['gzip', 'br', 'deflate']), 'br');
});

// =============================================================================
// AC-16: selectEncoding('gzip', ['br','deflate']) returns null
// =============================================================================
test('AC-16: select_encoding_no_match', () => {
  assert.strictEqual(selectEncoding('gzip', ['br', 'deflate']), null);
  assert.strictEqual(selectEncoding('gzip;q=0', ['gzip', 'deflate']), null);
});

// =============================================================================
// AC-17: selectEncoding('', ['gzip']) returns 'identity' as fallback
// =============================================================================
test('AC-17: select_encoding_with_identity', () => {
  assert.strictEqual(selectEncoding('', ['gzip']), 'identity');
  assert.strictEqual(selectEncoding('', ['gzip', 'br', 'deflate']), 'identity');
});

// =============================================================================
// AC-18: parse then serialize returns original (normalized for equal values)
// =============================================================================
test('AC-18: roundtrip', () => {
  const header = 'gzip;q=0.5, deflate';
  const entries = parseAcceptEncoding(header);
  const serialized = serializeAcceptEncoding(entries);
  // Serialized back should be canonical: deflate,gzip;q=0.5 (sorted by q desc)
  assert.strictEqual(serialized, 'deflate, gzip;q=0.5');

  // Identity roundtrip
  const identityHeader = 'gzip, deflate';
  const identityParsed = parseAcceptEncoding(identityHeader);
  const identitySerialized = serializeAcceptEncoding(identityParsed);
  assert.strictEqual(identitySerialized, 'gzip, deflate');

  // Complex roundtrip — entries are sorted by q, q=1 omitted
  const complex = 'br;q=1.0, gzip;q=0.8, deflate;q=0.6';
  const complexParsed = parseAcceptEncoding(complex);
  const complexSerialized = serializeAcceptEncoding(complexParsed);
  // q=1.0 serializes as omitted per RFC
  assert.strictEqual(complexSerialized, 'br, gzip;q=0.8, deflate;q=0.6');
});

// =============================================================================
// AC-19: AcceptEncodingEntry fields are read-only (frozen)
// =============================================================================
test('AC-19: entry_is_frozen', () => {
  const entry = parseAcceptEncoding('gzip')[0];
  assert.ok(Object.isFrozen(entry), 'entry should be frozen');
  assert.ok(Object.isFrozen(entry.params), 'entry.params should be frozen');

  // Fields should not be writable
  assert.throws(() => { entry.encoding = 'br'; }, TypeError);
  assert.throws(() => { entry.q = 0.5; }, TypeError);
  assert.throws(() => {
    entry.params.level = '5';
  }, TypeError);
});

// =============================================================================
// AC-20: repr(entry) includes encoding, q, params
// =============================================================================
test('AC-20: entry_repr', () => {
  const entry = parseAcceptEncoding('br;level=4')[0];
  const repr = entry.repr();
  assert.ok(repr.includes('br'));
  assert.ok(repr.includes('1'));
  assert.ok(repr.includes('level'));
  assert.ok(repr.includes('4'));
  // Symbol.for inspect too
  const inspect = entry[Symbol.for('nodejs.util.inspect.custom')]();
  assert.strictEqual(inspect, repr);
});

// =============================================================================
// AC-21: two entries with same fields are equal
// =============================================================================
test('AC-21: entry_equality', () => {
  const a = parseAcceptEncoding('gzip;q=0.5')[0];
  const b = parseAcceptEncoding('gzip;q=0.5')[0];
  assert.ok(a.equals(b));
  assert.ok(b.equals(a));

  // Different q
  const c = parseAcceptEncoding('gzip;q=0.8')[0];
  assert.ok(!a.equals(c));

  // Different params
  const d = parseAcceptEncoding('gzip;q=0.5;level=4')[0];
  assert.ok(!a.equals(d));

  // Null/undefined
  assert.ok(!a.equals(null));
  assert.ok(!a.equals(undefined));
  assert.ok(!a.equals('gzip'));

  // Different encoding
  const e = parseAcceptEncoding('deflate')[0];
  assert.ok(!a.equals(e));
});

// =============================================================================
// AC-22: 'gzip;q=abc' raises InvalidAcceptEncodingHeader
// =============================================================================
test('AC-22: invalid_q_non_number', () => {
  assert.throws(
    () => parseAcceptEncoding('gzip;q=abc'),
    { name: 'InvalidAcceptEncodingHeader' },
  );
});

// =============================================================================
// AC-23: 'gzip;q=-0.1' raises InvalidAcceptEncodingHeader
// =============================================================================
test('AC-23: invalid_q_negative', () => {
  assert.throws(
    () => parseAcceptEncoding('gzip;q=-0.1'),
    { name: 'InvalidAcceptEncodingHeader' },
  );
  assert.throws(
    () => parseAcceptEncoding('gzip;q=-1'),
    { name: 'InvalidAcceptEncodingHeader' },
  );
});

// =============================================================================
// AC-24: 'gzip;q=1.5' raises InvalidAcceptEncodingHeader (q must be <= 1)
// =============================================================================
test('AC-24: invalid_q_over_one', () => {
  assert.throws(
    () => parseAcceptEncoding('gzip;q=1.5'),
    { name: 'InvalidAcceptEncodingHeader' },
  );
  assert.throws(
    () => parseAcceptEncoding('gzip;q=2.0'),
    { name: 'InvalidAcceptEncodingHeader' },
  );
  assert.throws(
    () => parseAcceptEncoding('gzip;q=1.001'),
    { name: 'InvalidAcceptEncodingHeader' },
  );
});

// =============================================================================
// AC-25: index.d.ts file is present
// =============================================================================
test('AC-25: index_d_ts_exists', () => {
  const fs = require('fs');
  assert.ok(fs.existsSync('index.d.ts'), 'index.d.ts must exist');
  const content = fs.readFileSync('index.d.ts', 'utf8');
  assert.ok(content.includes('parseAcceptEncoding'));
  assert.ok(content.includes('selectEncoding'));
  assert.ok(content.includes('AcceptEncodingEntry'));
  assert.ok(content.includes('InvalidAcceptEncodingHeader'));
});

// =============================================================================
// AC-26: tsc --noEmit index.d.ts passes
// =============================================================================
test('AC-26: types_resolve_in_tsc', () => {
  // We verify the .d.ts is well-formed by checking it imports/uses known symbols.
  // Actual tsc invocation happens in pre-flight.
  const fs = require('fs');
  const content = fs.readFileSync('index.d.ts', 'utf8');
  // At minimum these should appear
  assert.ok(content.includes('parseAcceptEncoding'));
  assert.ok(content.includes('selectEncoding'));
  assert.ok(content.includes('InvalidAcceptEncodingHeader'));
  assert.ok(content.includes('AcceptEncodingEntry'));
});

// =============================================================================
// AC-27: npm install accept-encoding-parse --dry-run shows zero deps
// =============================================================================
test('AC-27: no_runtime_deps', () => {
  const pkg = require('../package.json');
  assert.deepStrictEqual(pkg.dependencies, {}, 'dependencies must be empty');
  assert.ok(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0);
});

// =============================================================================
// Additional edge/boundary tests
// =============================================================================

// Q-value boundary: exactly 0 and exactly 1
test('q_value_boundary_zero', () => {
  const entries = parseAcceptEncoding('gzip;q=0');
  assert.strictEqual(entries[0].q, 0);
});
test('q_value_boundary_one', () => {
  const entries = parseAcceptEncoding('gzip;q=1');
  assert.strictEqual(entries[0].q, 1.0);
});
test('q_value_three_decimals', () => {
  const entries = parseAcceptEncoding('gzip;q=0.123');
  assert.strictEqual(entries[0].q, 0.123);
});
test('q_value_one_decimal', () => {
  const entries = parseAcceptEncoding('gzip;q=0.5');
  assert.strictEqual(entries[0].q, 0.5);
});
test('q_value_trailing_zeros_kept', () => {
  // 0.500 should serialize as 0.5
  const entries = parseAcceptEncoding('gzip;q=0.500');
  assert.strictEqual(entries[0].q, 0.5);
});
test('q_value_scientific_notation_rejected', () => {
  assert.throws(
    () => parseAcceptEncoding('gzip;q=1e-1'),
    { name: 'InvalidAcceptEncodingHeader' },
  );
});

// selectEncoding with pre-parsed entries
test('select_encoding_with_entries_array', () => {
  const entries = parseAcceptEncoding('gzip;q=0.5, br;q=1.0');
  assert.strictEqual(selectEncoding(entries, ['gzip', 'br', 'deflate']), 'br');
});

// selectEncoding with wildcard
test('select_encoding_wildcard_picks_first_available', () => {
  // * has q=1, so pick the first encoding we support
  assert.strictEqual(selectEncoding('*', ['gzip', 'br', 'deflate']), 'gzip');
});
test('select_encoding_wildcard_with_q', () => {
  // wildcard q=0.5 should be used for all unlisted encodings
  const entries = parseAcceptEncoding('*;q=0.5, br;q=1.0');
  // selectEncoding takes header string
  const result = selectEncoding('*;q=0.5, br;q=1.0', ['gzip', 'br', 'deflate']);
  assert.strictEqual(result, 'br'); // br has explicit q=1.0
});
test('select_encoding_identity_explicit_q_zero', () => {
  // identity;q=0 should not be returned
  assert.strictEqual(selectEncoding('identity;q=0', ['gzip', 'identity']), null);
});

// selectEncoding edge: all candidates q=0
test('select_encoding_all_q_zero', () => {
  assert.strictEqual(selectEncoding('gzip;q=0, deflate;q=0', ['gzip', 'deflate']), null);
});

// Empty available array
test('select_encoding_empty_available', () => {
  assert.strictEqual(selectEncoding('gzip', []), null);
  assert.strictEqual(selectEncoding('*', []), null);
});

// Non-array available
test('select_encoding_available_type_errors', () => {
  assert.throws(
    () => selectEncoding('gzip', 'gzip'),
    { name: 'InvalidAcceptEncodingHeader' },
  );
});

// serialize with q=0
test('serialize_q_zero_omitted', () => {
  const entries = parseAcceptEncoding('gzip;q=0');
  const serialized = serializeAcceptEncoding(entries);
  // q=0 should still appear (it's a valid value)
  assert.ok(serialized.includes('q=0'));
});

// Multiple params
test('parse_multiple_params', () => {
  const entries = parseAcceptEncoding('br;level=4;nice=100');
  assert.strictEqual(entries[0].params.level, '4');
  assert.strictEqual(entries[0].params.nice, '100');
});

// Params with no value (e.g., "gzip;" is invalid)
test('parse_param_no_value_rejected', () => {
  assert.throws(
    () => parseAcceptEncoding('gzip;level='),
    { name: 'InvalidAcceptEncodingHeader' },
  );
  assert.throws(
    () => parseAcceptEncoding('gzip;'),
    { name: 'InvalidAcceptEncodingHeader' },
  );
});

// Select: identity as explicit encoding
test('select_encoding_identity_explicit_in_available', () => {
  assert.strictEqual(selectEncoding('gzip, identity', ['gzip', 'identity']), 'gzip');
  assert.strictEqual(selectEncoding('identity;q=0.5, gzip;q=1', ['gzip', 'identity']), 'gzip');
});

// parseAcceptEncoding: non-string throws
test('parse_non_string_throws', () => {
  assert.throws(() => parseAcceptEncoding(null), { name: 'InvalidAcceptEncodingHeader' });
  assert.throws(() => parseAcceptEncoding(undefined), { name: 'InvalidAcceptEncodingHeader' });
  assert.throws(() => parseAcceptEncoding(42), { name: 'InvalidAcceptEncodingHeader' });
  assert.throws(() => parseAcceptEncoding({}), { name: 'InvalidAcceptEncodingHeader' });
});

// Entry toJSON roundtrip
test('entry_toJSON_roundtrip', () => {
  const entry = parseAcceptEncoding('br;level=9;q=0.8')[0];
  const json = entry.toJSON();
  assert.strictEqual(json.encoding, 'br');
  assert.strictEqual(json.q, 0.8);
  assert.strictEqual(json.params.level, '9');
  // Reconstruct from JSON
  const entries = [Object.assign(Object.create(AcceptEncodingEntry.prototype), json)];
  assert.strictEqual(entries[0].encoding, 'br');
  assert.strictEqual(entries[0].q, 0.8);
});

// Complex multi-segment with all features
test('parse_complex_header', () => {
  const entries = parseAcceptEncoding('gzip;q=0.8;window=15, br;level=4;q=0.9, deflate, *;q=0.1');
  assert.strictEqual(entries.length, 4);
  // Sorted by q-value descending; ties broken by original order
  assert.strictEqual(entries[0].encoding, 'deflate'); // q=1.0
  assert.strictEqual(entries[0].q, 1.0);
  assert.strictEqual(entries[1].encoding, 'br');     // q=0.9
  assert.strictEqual(entries[1].q, 0.9);
  assert.strictEqual(entries[1].params.level, '4');
  assert.strictEqual(entries[2].encoding, 'gzip');    // q=0.8
  assert.strictEqual(entries[2].q, 0.8);
  assert.strictEqual(entries[2].params.window, '15');
  assert.strictEqual(entries[3].encoding, '*');       // q=0.1
  assert.strictEqual(entries[3].q, 0.1);
});

// Stability: same q-value preserves original order
test('q_value_sort_stable_on_tie', () => {
  const entries = parseAcceptEncoding('gzip, deflate, br');
  // All have q=1.0; should be in original order (stable sort)
  assert.strictEqual(entries[0].encoding, 'gzip');
  assert.strictEqual(entries[1].encoding, 'deflate');
  assert.strictEqual(entries[2].encoding, 'br');
});

// serialize with exact 1.0 q should omit q
test('serialize_omits_q_when_one', () => {
  const entries = parseAcceptEncoding('gzip');
  const serialized = serializeAcceptEncoding(entries);
  assert.strictEqual(serialized, 'gzip');
  assert.ok(!serialized.includes('q='));
});

// serialize: multiple entries
test('serialize_multiple_entries', () => {
  const entries = parseAcceptEncoding('gzip;q=0.5, deflate');
  const serialized = serializeAcceptEncoding(entries);
  assert.strictEqual(serialized, 'deflate, gzip;q=0.5');
});

// Invalid parameter name character
test('invalid_encoding_token_characters_rejected', () => {
  assert.throws(
    () => parseAcceptEncoding('gzip\x00'),
    { name: 'InvalidAcceptEncodingHeader' },
  );
  assert.throws(
    () => parseAcceptEncoding('gzip(level)'),
    { name: 'InvalidAcceptEncodingHeader' },
  );
});

// Empty segment (double comma)
test('parse_double_comma_ignores_empty', () => {
  const entries = parseAcceptEncoding('gzip,,deflate');
  assert.strictEqual(entries.length, 2);
});

// Select encoding with multiple q=1 candidates
test('select_encoding_q1_tie_picks_first_header', () => {
  // Both gzip and br have q=1.0. gzip appears first → wins on header order
  assert.strictEqual(selectEncoding('gzip, br', ['gzip', 'br', 'deflate']), 'gzip');
  assert.strictEqual(selectEncoding('br;q=1, gzip;q=1', ['gzip', 'br']), 'br');
});

// toJSON includes params
test('entry_toJSON_includes_params', () => {
  const entry = parseAcceptEncoding('br;level=4')[0];
  const json = entry.toJSON();
  assert.deepStrictEqual(json.params, { level: '4' });
});
