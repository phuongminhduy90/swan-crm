import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Story PI-4 (Sprint 7.2) — `actualProcedureDate` is the source of truth
 * for D1–D90 follow-up scheduling.
 *
 * Acceptance criteria:
 *   - `resolveProcedureDateForFollowups()` prefers `actualProcedureDate`
 *     (priority 1) over `expectedProcedureDate` (priority 2).
 *   - Falls back to a terminal "now" ISO string when both are missing.
 *   - `createPostOpFollowups()` writes 6 follow-ups (D1/D3/D7/D14/D30/D90)
 *     whose `dueDate` is `procedureDate + offset days` (UTC ISO).
 *   - Accepts both `Date` and ISO `string` as the procedure date.
 *   - Each created followup is initialised in `pending` state with
 *     `requestedImage=false` and `imageUploaded=false`.
 *
 * @see docs/ux-redesign/STORY_PI_4_IMPLEMENTATION_REPORT.md
 * @see docs/ux-redesign/SPRINT_7_2_EXECUTION_PLAN.md §1 row 9 (PI-4)
 */

// ─── Module mocks ────────────────────────────────────────────────────────────

const mockSetDocument = vi.fn();
vi.mock('@/lib/firebase/firestore', () => ({
  setDocument: (...args: unknown[]) => mockSetDocument(...args),
  updateDocument: vi.fn(),
  getAllDocuments: vi.fn().mockResolvedValue([]),
  getDocument: vi.fn().mockResolvedValue(null),
}));

import {
  createPostOpFollowups,
  resolveProcedureDateForFollowups,
} from '@/lib/firestore/followups';

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('PI-4 — Follow-ups: actualProcedureDate is source of truth', () => {
  beforeEach(() => {
    mockSetDocument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. resolveProcedureDateForFollowups priority order ────────────────

  describe('resolveProcedureDateForFollowups() — priority order', () => {
    it('returns `actualProcedureDate` when set (priority 1)', () => {
      const result = resolveProcedureDateForFollowups({
        actualProcedureDate: '2026-07-01T00:00:00.000Z',
        expectedProcedureDate: '2026-06-25T00:00:00.000Z',
      });
      expect(result).toBe('2026-07-01T00:00:00.000Z');
    });

    it('falls back to `expectedProcedureDate` when `actualProcedureDate` is missing (priority 2)', () => {
      const result = resolveProcedureDateForFollowups({
        expectedProcedureDate: '2026-06-25T00:00:00.000Z',
      });
      expect(result).toBe('2026-06-25T00:00:00.000Z');
    });

    it('falls back to a "now" ISO string when neither date is set (priority 3)', () => {
      const before = Date.now();
      const result = resolveProcedureDateForFollowups({});
      const after = Date.now();

      expect(result).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      const ts = new Date(result).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after + 50); // 50ms tolerance for fast CI
    });

    it('treats empty-string `actualProcedureDate` as missing (falls through)', () => {
      const result = resolveProcedureDateForFollowups({
        actualProcedureDate: '',
        expectedProcedureDate: '2026-06-25T00:00:00.000Z',
      });
      expect(result).toBe('2026-06-25T00:00:00.000Z');
    });

    it('treats empty-string `expectedProcedureDate` as missing (falls through)', () => {
      const result = resolveProcedureDateForFollowups({
        actualProcedureDate: undefined,
        expectedProcedureDate: '',
      });
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('does NOT mutate the input record (pure)', () => {
      const input = {
        actualProcedureDate: '2026-07-01T00:00:00.000Z',
        expectedProcedureDate: '2026-06-25T00:00:00.000Z',
      };
      const snapshot = { ...input };
      resolveProcedureDateForFollowups(input);
      expect(input).toEqual(snapshot);
    });
  });

  // ─── 2. createPostOpFollowups shape + offsets ─────────────────────────

  describe('createPostOpFollowups() — D1/D3/D7/D14/D30/D90 trail', () => {
    it('writes exactly 6 followup rows (D1, D3, D7, D14, D30, D90)', async () => {
      await createPostOpFollowups('case-001', 'cust-001', '2026-07-01T00:00:00.000Z', undefined);
      expect(mockSetDocument).toHaveBeenCalledTimes(6);
    });

    it('uses the procedure date + offsets for the dueDate (UTC ISO)', async () => {
      const base = '2026-07-01T00:00:00.000Z';
      await createPostOpFollowups('case-001', 'cust-001', base, undefined);

      const calls = mockSetDocument.mock.calls as Array<[string, string, Record<string, unknown>]>;
      const byFollowupDay = new Map<string, string>();
      for (const [, , payload] of calls) {
        byFollowupDay.set(payload.followupDay as string, payload.dueDate as string);
      }

      const baseMs = new Date(base).getTime();
      const day = 24 * 60 * 60 * 1000;
      const expected: Array<[string, number]> = [
        ['D1', 1 * day],
        ['D3', 3 * day],
        ['D7', 7 * day],
        ['D14', 14 * day],
        ['D30', 30 * day],
        ['D90', 90 * day],
      ];
      for (const [day, offset] of expected) {
        expect(byFollowupDay.get(day)).toBeDefined();
        const ts = new Date(byFollowupDay.get(day) as string).getTime();
        expect(ts).toBe(baseMs + offset);
      }
    });

    it('accepts a `Date` instance as the procedure date', async () => {
      const date = new Date('2026-07-01T00:00:00.000Z');
      await createPostOpFollowups('case-001', 'cust-001', date, undefined);
      expect(mockSetDocument).toHaveBeenCalledTimes(6);
    });

    it('initialises every followup in `pending` state', async () => {
      await createPostOpFollowups('case-001', 'cust-001', '2026-07-01T00:00:00.000Z', undefined);

      for (const [, , payload] of mockSetDocument.mock.calls as Array<
        [string, string, Record<string, unknown>]
      >) {
        expect(payload.status).toBe('pending');
        expect(payload.requestedImage).toBe(false);
        expect(payload.imageUploaded).toBe(false);
      }
    });

    it('propagates `caseId` + `customerId` + optional `assignedTo` on every row', async () => {
      await createPostOpFollowups('case-001', 'cust-001', '2026-07-01T00:00:00.000Z', 'user-007');

      for (const [, , payload] of mockSetDocument.mock.calls as Array<
        [string, string, Record<string, unknown>]
      >) {
        expect(payload.caseId).toBe('case-001');
        expect(payload.customerId).toBe('cust-001');
        expect(payload.assignedTo).toBe('user-007');
      }
    });

    it('writes unique ids per day (D1, D3, D7, D14, D30, D90)', async () => {
      await createPostOpFollowups('case-001', 'cust-001', '2026-07-01T00:00:00.000Z', undefined);

      const ids = new Set<string>();
      for (const [, id] of mockSetDocument.mock.calls as Array<[string, string, unknown]>) {
        ids.add(id);
      }
      expect(ids.size).toBe(6);
      for (const id of ids) {
        expect(id).toMatch(/^fup-case-001-D\d+-/);
      }
    });

    it('returns the 6 created followups from the function', async () => {
      const created = await createPostOpFollowups(
        'case-001',
        'cust-001',
        '2026-07-01T00:00:00.000Z',
        undefined,
      );
      expect(created).toHaveLength(6);
      const days = created.map((f) => f.followupDay).sort();
      expect(days).toEqual(['D1', 'D14', 'D3', 'D30', 'D7', 'D90']);
    });
  });

  // ─── 3. End-to-end: actual procedure date flows into followup dates ───

  describe('E2E — actualProcedureDate flows into the dueDate trail', () => {
    it('uses the date resolved via resolveProcedureDateForFollowups', async () => {
      // Simulate the case-record path: the API helper resolves the
      // procedure date, then passes it to createPostOpFollowups.
      const caseRecord = {
        actualProcedureDate: '2026-07-15T00:00:00.000Z',
        expectedProcedureDate: '2026-07-10T00:00:00.000Z',
      };
      const procedureDate = resolveProcedureDateForFollowups(caseRecord);
      await createPostOpFollowups('case-001', 'cust-001', procedureDate, undefined);

      // D1 should anchor to 2026-07-16 (actual + 1 day), NOT 2026-07-11
      // (expected + 1 day). Locks in the contract.
      const calls = mockSetDocument.mock.calls as Array<[string, string, Record<string, unknown>]>;
      const d1 = calls.find(([, , p]) => p.followupDay === 'D1');
      expect(d1?.[2].dueDate).toBe('2026-07-16T00:00:00.000Z');
    });

    it('falls back to expectedProcedureDate when actual is missing — preserves the legacy contract', async () => {
      const caseRecord = {
        expectedProcedureDate: '2026-06-25T00:00:00.000Z',
      };
      const procedureDate = resolveProcedureDateForFollowups(caseRecord);
      await createPostOpFollowups('case-001', 'cust-001', procedureDate, undefined);

      const calls = mockSetDocument.mock.calls as Array<[string, string, Record<string, unknown>]>;
      const d1 = calls.find(([, , p]) => p.followupDay === 'D1');
      expect(d1?.[2].dueDate).toBe('2026-06-26T00:00:00.000Z');
    });
  });
});
