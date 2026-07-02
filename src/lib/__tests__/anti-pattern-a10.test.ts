/**
 * Story PI-5 — A10 anti-pattern catalog row guard.
 *
 * Sprint 7.2 PI-5 extends `scripts/check-anti-patterns.sh` with a new A10
 * row that catches raw `<input type="number">` patterns used for currency
 * (Sprint 7.2 §6.4 + R7.2-9). The row replaces the gap left after TD-6
 * shipped a focused catalog of {A2, A8, A9, ESC}.
 *
 * This test is a meta-guard: it asserts (a) the script source contains the
 * A10 row in the catalog arrays, (b) the regex semantics match the
 * documented positive/negative fixtures, and (c) running the script with
 * `--all` against the current tree still exits 0 (so we didn't break
 * pre-existing callsites when wiring the regex).
 *
 * Note: the regex is replicated here (in JS / ESM regex syntax) for fast
 * in-process assertion. The canonical regex lives in `scripts/check-anti-patterns.sh`
 * — the source of truth. If you change the bash regex, mirror it here.
 *
 * @see docs/ux-redesign/SPRINT_7_2_EXECUTION_PLAN.md §6.4 (A10 row)
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../../../');
const SCRIPT = path.join(REPO_ROOT, 'scripts/check-anti-patterns.sh');

/**
 * A10 regex literal — mirrors the bash catalog entry. The bash variant uses
 * POSIX ERE (`grep -E`) where `[^>]` does NOT span newlines by default.
 * JavaScript's negated character class DOES include newlines; we exclude
 * `\n` explicitly so the JS literal mirrors the bash behavior byte-for-byte.
 */
const A10_REGEX = /<[iI]nput[^>\n]*(type=['"]number['"])[^>\n]*(currency|amount|price|VNĐ|tiền)/;

// Positive cases — must match A10 (these are exactly the regressions we
// want to block: raw numeric input wired to a currency context).
const POSITIVE = [
  '<input type="number" name="amount" />',
  '<Input type="number" name="amount" />',
  '<input type="number" name="currency" />',
  "<input type='number' placeholder='VNĐ' />",
  '<input type="number" name="price" />',
  '<input type="number" placeholder="Nhập số tiền (VNĐ)" />',
];

// Negative cases — must NOT match A10.
const NEGATIVE = [
  '<input type="number" name="quantity" />', // not currency keyword
  '<input type="number" min={0} step={1} />', // integers, no currency kw
  '<input type="text" name="amount" />', // wrong type, not numeric
  '<input\n  type="number"\n  name="amount"\n/>', // multiline — intentionally NOT matched
  '<input type="number" data-testid="not-money" />',
  '// Note: chuyển đổi sang <CurrencyInput> để fix A10',
];

describe('PI-5 — A10 anti-pattern catalog row', () => {
  describe('script source integrity', () => {
    it('anti-patterns script exists in scripts/', () => {
      expect(existsSync(SCRIPT)).toBe(true);
    });

    it('catalog array includes the A10 row', () => {
      const source = readFileSync(SCRIPT, 'utf8');
      expect(source).toMatch(/CATALOG_IDS=[\s\S]*?"A10"[\s\S]*?\)/);
    });

    it('catalog description row for A10 mentions CurrencyInput (the recovery primitive)', () => {
      const source = readFileSync(SCRIPT, 'utf8');
      expect(source).toMatch(/CurrencyInput/);
    });

    it('catalog scope row for A10 is src/components', () => {
      const source = readFileSync(SCRIPT, 'utf8');
      const a10Marker = source.indexOf('A10');
      expect(a10Marker).toBeGreaterThan(-1);
      // The scope rows live in CATALOG_SCOPES; assert that the row at the
      // A10 index in that array is "src/components".
      const scopesMatch = source.match(/CATALOG_SCOPES=\(([\s\S]*?)\)/);
      expect(scopesMatch).not.toBeNull();
      const scopeRows = scopesMatch![1]!.match(/"[^"]*"/g) ?? [];
      // Find index of "A10" in CATALOG_IDS to map to CATALOG_SCOPES.
      const idsMatch = source.match(/CATALOG_IDS=\(([\s\S]*?)\)/);
      expect(idsMatch).not.toBeNull();
      const idRows = idsMatch![1]!.match(/"[^"]*"/g) ?? [];
      const a10Idx = idRows.findIndex((row) => row === '"A10"');
      expect(a10Idx).toBeGreaterThan(-1);
      expect(scopeRows[a10Idx]).toBe('"src/components"');
    });
  });

  describe('regex semantics (in-process fidelity check)', () => {
    it.each(POSITIVE)('matches deliberate A10 violation: %s', (snippet) => {
      expect(A10_REGEX.test(snippet)).toBe(true);
    });

    it.each(NEGATIVE)('does NOT match benign snippet: %s', (snippet) => {
      expect(A10_REGEX.test(snippet)).toBe(false);
    });
  });

  describe('script runtime (--all against current source tree)', () => {
    it('exits 0 — TD-7 + A10 additions did not introduce catalog regressions', () => {
      const result = spawnSync('bash', [SCRIPT, '--all'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });
      if (result.status !== 0) {
        throw new Error(
          `check-anti-patterns.sh --all failed.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
        );
      }
      expect(result.status).toBe(0);
    }, 30_000);
  });
});
