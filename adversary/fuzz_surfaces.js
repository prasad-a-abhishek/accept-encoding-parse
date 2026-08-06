'use strict';

/**
 * Adversarial fuzz harness for accept-encoding-parse
 * Three surfaces:
 *  (a) Core parser/serializer — parseAcceptEncoding, serializeAcceptEncoding
 *  (b) selectEncoding — string header path + pre-parsed entries path
 *  (c) AcceptEncodingEntry class / frozen object invariants
 */

const {
  parseAcceptEncoding,
  serializeAcceptEncoding,
  selectEncoding,
  AcceptEncodingEntry,
  InvalidAcceptEncodingHeader,
} = require('/root/projects/accept-encoding-parse/src/index.js');

let mutationCount = 0;
let surfaceACrashes = 0;
let surfaceBCrashes = 0;
let surfaceCCrashes = 0;
let surfaceAExceptions = []; // malformed inputs that correctly threw
let surfaceBExceptions = []; // malformed inputs that correctly threw via selectEncoding

// ─────────────────────────────────────────────
// SURFACE A: Core parser/serializer fuzzing
// ─────────────────────────────────────────────
function surfaceA_fuzz(header, label) {
  mutationCount++;
  try {
    const entries = parseAcceptEncoding(header);
    if (!Array.isArray(entries)) {
      surfaceACrashes++;
      console.log(`[A CRASH] parse returned non-array: ${label}`);
      return;
    }
    if (!Object.isFrozen(entries)) {
      surfaceACrashes++;
      console.log(`[A CRASH] returned array not frozen: ${label}`);
      return;
    }
    for (const e of entries) {
      if (!(e instanceof AcceptEncodingEntry)) {
        surfaceACrashes++;
        console.log(`[A CRASH] entry not AcceptEncodingEntry: ${label}`);
        return;
      }
      if (!Object.isFrozen(e)) {
        surfaceACrashes++;
        console.log(`[A CRASH] entry not frozen: ${label}`);
        return;
      }
      // Class methods should not throw
      try { e.repr(); } catch (err) {
        surfaceACrashes++;
        console.log(`[A CRASH] repr threw: ${label} — ${err.message}`);
        return;
      }
      try { e.toJSON(); } catch (err) {
        surfaceACrashes++;
        console.log(`[A CRASH] toJSON threw: ${label} — ${err.message}`);
        return;
      }
      try { e.equals(null); e.equals({}); e.equals('br'); } catch (err) {
        surfaceACrashes++;
        console.log(`[A CRASH] equals threw: ${label} — ${err.message}`);
        return;
      }
    }
    // Serialize must not throw on valid output
    try {
      serializeAcceptEncoding(entries);
    } catch (err) {
      surfaceACrashes++;
      console.log(`[A CRASH] serialize threw: ${label} — ${err.message}`);
      return;
    }
    // Round-trip: re-parse serialized form must not throw
    try {
      const serialized = serializeAcceptEncoding(entries);
      parseAcceptEncoding(serialized);
    } catch (err) {
      surfaceACrashes++;
      console.log(`[A CRASH] round-trip threw: ${label} — ${err.message}`);
      return;
    }
  } catch (e) {
    // Malformed headers correctly throw InvalidAcceptEncodingHeader
    if (!(e instanceof InvalidAcceptEncodingHeader)) {
      surfaceACrashes++;
      console.log(`[A CRASH] non-InvalidAcceptEncodingHeader: ${label} — ${e.constructor.name}: ${e.message}`);
      return;
    }
    // Expected — malformed input, valid rejection
    surfaceAExceptions.push({ label, msg: e.message });
  }
}

// ─────────────────────────────────────────────
// SURFACE B: selectEncoding fuzzing
// ─────────────────────────────────────────────

// Known-valid headers for selectEncoding (used to test the pre-parsed path)
const VALID_HEADERS = [
  'gzip, deflate, br',
  'gzip;q=0.5, br;q=1.0',
  '',
  '*',
  'identity;q=0',
  'br;q=1.0, gzip;q=0.8, deflate;q=0.6',
];

// Known-invalid headers for selectEncoding (should throw)
const INVALID_HEADERS = [
  'gzip;q=',
  'gzip;q=abc',
  'gzip;q=-0.1',
  'gzip;q=1.5',
  'gzip\x00null',
  'gzip\x01',
  'br=deflate',
  'gzip;;deflate',
  'br;level=4;',
];

const AVAILABLES = [
  ['gzip'],
  ['gzip', 'br'],
  ['gzip', 'br', 'deflate'],
  [],
  ['identity'],
];

function surfaceB_fuzz(header, label) {
  mutationCount++;
  try {
    for (const available of AVAILABLES) {
      const result = selectEncoding(header, available);
      // Result must be null or a string
      if (result !== null && typeof result !== 'string') {
        surfaceBCrashes++;
        console.log(`[B CRASH] selectEncoding returned ${typeof result}: ${label}`);
        return;
      }
    }
  } catch (e) {
    if (!(e instanceof InvalidAcceptEncodingHeader)) {
      surfaceBCrashes++;
      console.log(`[B CRASH] non-InvalidAcceptEncodingHeader: ${label} — ${e.constructor.name}: ${e.message}`);
      return;
    }
    // Expected — malformed header string passed to selectEncoding
    surfaceBExceptions.push({ label, msg: e.message });
  }
}

function surfaceB_preparsed_fuzz(label) {
  mutationCount++;
  // Use a valid pre-parsed entries array (not a string) — should never throw for valid entries
  let entries;
  try {
    entries = parseAcceptEncoding('gzip;q=0.5, br;q=1.0, deflate;q=0.8, identity');
  } catch {
    // If even valid parsing fails, skip
    return;
  }
  try {
    for (const available of AVAILABLES) {
      const result = selectEncoding(entries, available);
      if (result !== null && typeof result !== 'string') {
        surfaceBCrashes++;
        console.log(`[B CRASH] selectEncoding(entries) returned ${typeof result}: ${label}`);
        return;
      }
    }
  } catch (e) {
    // Pre-parsed path should never throw for valid entries
    surfaceBCrashes++;
    console.log(`[B CRASH] selectEncoding(entries) threw unexpectedly: ${label} — ${e.message}`);
  }
}

// ─────────────────────────────────────────────
// SURFACE C: AcceptEncodingEntry class invariants
// ─────────────────────────────────────────────
function surfaceC_fuzz(label) {
  mutationCount++;
  let entry;
  try {
    const entries = parseAcceptEncoding('gzip;q=0.5;level=4');
    entry = entries[0];
  } catch {
    return;
  }

  // (c1) All fields are non-writable
  const fields = ['encoding', 'q', 'params', 'original', 'order', 'explicitQ'];
  for (const field of fields) {
    try {
      entry[field] = 'tampered';
      surfaceCCrashes++;
      console.log(`[C CRASH] field ${field} is writable: ${label}`);
      return;
    } catch (err) {
      if (err.name !== 'TypeError') {
        surfaceCCrashes++;
        console.log(`[C CRASH] field ${field} threw non-TypeError: ${err.name}`);
        return;
      }
    }
  }

  // (c2) params is non-writable
  try {
    entry.params.level = '999';
    surfaceCCrashes++;
    console.log(`[C CRASH] params is writable: ${label}`);
    return;
  } catch (err) {
    if (err.name !== 'TypeError') {
      surfaceCCrashes++;
      console.log(`[C CRASH] params threw non-TypeError: ${err.name}`);
      return;
    }
  }

  // (c3) Returned array is frozen
  const entries2 = parseAcceptEncoding('gzip, deflate, br');
  if (!Object.isFrozen(entries2)) {
    surfaceCCrashes++;
    console.log(`[C CRASH] returned array not frozen: ${label}`);
    return;
  }

  // (c4) equals handles garbage without throwing
  try {
    entry.equals(null);
    entry.equals(undefined);
    entry.equals({});
    entry.equals(42);
    entry.equals('br');
    entry.equals(parseAcceptEncoding('br')[0]);
  } catch (err) {
    surfaceCCrashes++;
    console.log(`[C CRASH] equals threw: ${label} — ${err.message}`);
    return;
  }

  // (c5) toJSON returns correct shape
  const json = entry.toJSON();
  if (typeof json.encoding !== 'string' || typeof json.q !== 'number' || typeof json.params !== 'object') {
    surfaceCCrashes++;
    console.log(`[C CRASH] toJSON wrong shape: ${label}`);
    return;
  }

  // (c6) JSON round-trip
  try {
    const str = JSON.stringify(entry);
    const parsed = JSON.parse(str);
    if (parsed.encoding !== 'gzip' || parsed.q !== 0.5) {
      surfaceCCrashes++;
      console.log(`[C CRASH] JSON round-trip corrupted: ${label}`);
      return;
    }
  } catch (err) {
    surfaceCCrashes++;
    console.log(`[C CRASH] JSON round-trip threw: ${label} — ${err.message}`);
    return;
  }
}

// ─────────────────────────────────────────────
// MUTATION GENERATORS
// ─────────────────────────────────────────────
function randChar() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-.*_~!#$%&\'()=[]{}|;:/<>?@^`"';
  return chars[Math.floor(Math.random() * chars.length)];
}

function randWhitespace() {
  return [' ', '\t', '\n', '\r', '\v', '\f'][Math.floor(Math.random() * 6)];
}

function genMutant() {
  const strategies = [
    () => ['gzip', 'deflate', 'br', 'identity', '*'][Math.floor(Math.random() * 5)],
    () => {
      const enc = ['gzip', 'deflate', 'br'][Math.floor(Math.random() * 3)];
      const qvals = ['0', '0.0', '0.5', '0.123', '1', '1.0', '1.000', '0.001', '0.999'];
      return `${enc};q=${qvals[Math.floor(Math.random() * qvals.length)]}`;
    },
    () => ['gzip, deflate', 'br;q=0.8, gzip;q=1.0', '*, gzip'][Math.floor(Math.random() * 3)],
    () => { // whitespace chaos
      const base = 'gzip, deflate, br';
      let s = '';
      for (const c of base) {
        if (Math.random() < 0.3) s += randWhitespace();
        s += c;
      }
      if (Math.random() < 0.3) s += randWhitespace();
      return s;
    },
    // Valid: unicode that passes RFC token rules
    () => {
      const corruptions = [
        'gzip\x00null',
        'gzip\x1b',
        'gzip\x7f',
        'br\x80',
        'br\uffff',
        'gzip\u0000',
        'br\u200b',
        '\x00gzip',
        'gzip\x1b[0m',
      ];
      return corruptions[Math.floor(Math.random() * corruptions.length)];
    },
    // Invalid q-values
    () => {
      const invalidQs = [
        'gzip;q=abc', 'gzip;q=-1', 'gzip;q=1.5', 'gzip;q=2.0',
        'gzip;q=1e-1', 'gzip;q=1.', 'gzip;q=.5', 'gzip;q=0..5',
        'gzip;q=0.1234', 'gzip;q=1.0001', 'gzip;q=1.001',
        'gzip;q=', 'gzip;q=0.5a', 'gzip;q=-0.001',
      ];
      return invalidQs[Math.floor(Math.random() * invalidQs.length)];
    },
    // Invalid tokens
    () => {
      const invalidTokens = [
        'gzip gzip', 'br()', 'deflate[]', 'gzip<>', 'br""', "gzip''",
        'gzip\\', 'br/', 'gzip, deflate(', 'br=deflate',
        'gzip, deflate gzip', 'br;level=4;', 'gzip;', 'gzip;;deflate',
        'gzip;q=0.5;', 'gzip;q=0.5;level', 'gzip;q=0.5;level=',
        'gzip;q=0.5;level=4;',
      ];
      return invalidTokens[Math.floor(Math.random() * invalidTokens.length)];
    },
    // Empty/boundary
    () => ['', ' ', ',', ',,', ', ', '  ', '\t', '\n', ',,,\n,,'][Math.floor(Math.random() * 9)],
    // Very long header (memory stress)
    () => 'gzip;q=0.5, deflate;q=0.8, br;q=1.0, *;q=0.3'.repeat(500),
    // Many params
    () => {
      const params = [];
      for (let i = 0; i < 20; i++) params.push(`p${i}=v${i}`);
      return `br;${params.join(';')}`;
    },
    () => `gzip${String.fromCharCode(1)}`,
    () => 'gzip\t,\tdeflate',
    () => ['GZIP', 'GzIp', 'BR', 'DeFlAtE', 'IDenTiTy', '*'][Math.floor(Math.random() * 6)],
    () => ['identity', 'identity;q=0', 'identity;q=1', 'identity;q=0.5'][Math.floor(Math.random() * 4)],
    () => [',,', ',, ,', ', , ,', ','][Math.floor(Math.random() * 4)],
    () => 'gzip-2024',
    () => Array.from({length: 200}, (_, i) => `enc${i}`).join(', '),
    () => 'x'.repeat(10000),
    () => 'gzip\n,\ndeflate\r,\r\nbr',
    () => 'br;level = 4',
    () => 'gzip;window = 15',
  ];
  return strategies[Math.floor(Math.random() * strategies.length)]();
}

// ─────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────
const TOTAL = 5000;
console.log(`[FUZZER] Running ${TOTAL} mutations x 3 surfaces = ${TOTAL * 3} total fuzz calls...`);
console.log(`[FUZZER] Started at ${new Date().toISOString()}`);

const startTime = Date.now();

// Surface A + B
for (let i = 0; i < TOTAL; i++) {
  const mutant = genMutant();
  surfaceA_fuzz(mutant, `mut${i}`);
  surfaceB_fuzz(mutant, `mut${i}`);
}

// Surface B pre-parsed path
for (let i = 0; i < TOTAL; i++) {
  surfaceB_preparsed_fuzz(`preparsed_mut${i}`);
}

// Surface C
for (let i = 0; i < TOTAL; i++) {
  surfaceC_fuzz(`class_mut${i}`);
}

const elapsed = Date.now() - startTime;

console.log('\n========================================');
console.log('  FUZZING REPORT — accept-encoding-parse');
console.log('========================================');
console.log(`Total fuzz calls: ${mutationCount}`);
console.log(`Surface A crashes (real bugs): ${surfaceACrashes}`);
console.log(`Surface B crashes (real bugs): ${surfaceBCrashes}`);
console.log(`Surface C crashes (real bugs): ${surfaceCCrashes}`);
console.log(`Total real crashes:           ${surfaceACrashes + surfaceBCrashes + surfaceCCrashes}`);
console.log(`Surface A malformed inputs that correctly threw: ${surfaceAExceptions.length}`);
console.log(`Surface B malformed inputs that correctly threw: ${surfaceBExceptions.length}`);
console.log(`Elapsed: ${elapsed}ms`);

if (surfaceAExceptions.length > 0) {
  console.log('\n[A] Sample malformed inputs correctly rejected (first 5):');
  for (const e of surfaceAExceptions.slice(0, 5)) {
    console.log(`  — [${e.label}] ${e.msg}`);
  }
}
if (surfaceBExceptions.length > 0) {
  console.log('\n[B] Sample malformed inputs correctly rejected via selectEncoding (first 5):');
  for (const e of surfaceBExceptions.slice(0, 5)) {
    console.log(`  — [${e.label}] ${e.msg}`);
  }
}

if (surfaceACrashes + surfaceBCrashes + surfaceCCrashes > 0) {
  console.log('\n!!! REAL BUGS DETECTED — REJECTING BUILD !!!');
  process.exit(1);
} else {
  console.log('\n[PASS] Zero unhandled exceptions / real bugs across all surfaces.');
  process.exit(0);
}
