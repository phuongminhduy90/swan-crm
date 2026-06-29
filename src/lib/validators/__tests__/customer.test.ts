import { describe, it, expect } from 'vitest';
import {
  createCustomerSchema,
  updateCustomerSchema,
} from '@/lib/validators/customer';

/**
 * Story B.1.1 — CCCD (Căn cước công dân) fields in customer form.
 *
 * Validates:
 * - `nationalIdNumber`: accepts 9-digit CMND or 12-digit CCCD; rejects others
 * - `nationalIdIssueDate`: free-form date string, optional
 * - `nationalIdIssuePlace`: max 200 chars
 * - All 3 fields are optional / allow empty string
 * - Round-trip: data flows into and out of schema cleanly
 */

// ─── Helper ──────────────────────────────────────────────────────────────────

const VALID_BASE = {
  fullName: 'Nguyễn Văn A',
  phone: '0901234567',
};

function buildValidInput(overrides: Record<string, unknown> = {}) {
  return { ...VALID_BASE, ...overrides };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Customer Zod schema — CCCD fields (Story B.1.1)', () => {
  describe('nationalIdNumber', () => {
    it('accepts empty string (no CCCD provided)', () => {
      const result = createCustomerSchema.safeParse(buildValidInput({ nationalIdNumber: '' }));
      expect(result.success).toBe(true);
    });

    it('accepts undefined (omitted entirely)', () => {
      const result = createCustomerSchema.safeParse(buildValidInput());
      expect(result.success).toBe(true);
    });

    it('accepts 9-digit CMND', () => {
      const result = createCustomerSchema.safeParse(
        buildValidInput({ nationalIdNumber: '123456789' }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nationalIdNumber).toBe('123456789');
      }
    });

    it('accepts 12-digit CCCD', () => {
      const result = createCustomerSchema.safeParse(
        buildValidInput({ nationalIdNumber: '001234567890' }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nationalIdNumber).toBe('001234567890');
      }
    });

    it('rejects 8-digit string', () => {
      const result = createCustomerSchema.safeParse(
        buildValidInput({ nationalIdNumber: '12345678' }),
      );
      expect(result.success).toBe(false);
    });

    it('rejects 10-digit string', () => {
      const result = createCustomerSchema.safeParse(
        buildValidInput({ nationalIdNumber: '1234567890' }),
      );
      expect(result.success).toBe(false);
    });

    it('rejects 13-digit string', () => {
      const result = createCustomerSchema.safeParse(
        buildValidInput({ nationalIdNumber: '1234567890123' }),
      );
      expect(result.success).toBe(false);
    });

    it('rejects string with letters', () => {
      const result = createCustomerSchema.safeParse(
        buildValidInput({ nationalIdNumber: '12345abcde' }),
      );
      expect(result.success).toBe(false);
    });

    it('rejects string with dashes/spaces', () => {
      const result = createCustomerSchema.safeParse(
        buildValidInput({ nationalIdNumber: '123-456-789' }),
      );
      expect(result.success).toBe(false);
    });
  });

  describe('nationalIdIssueDate', () => {
    it('accepts empty string', () => {
      const result = createCustomerSchema.safeParse(
        buildValidInput({ nationalIdIssueDate: '' }),
      );
      expect(result.success).toBe(true);
    });

    it('accepts undefined', () => {
      const result = createCustomerSchema.safeParse(buildValidInput());
      expect(result.success).toBe(true);
    });

    it('accepts a date string', () => {
      const result = createCustomerSchema.safeParse(
        buildValidInput({ nationalIdIssueDate: '2020-01-15' }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('nationalIdIssuePlace', () => {
    it('accepts empty string', () => {
      const result = createCustomerSchema.safeParse(
        buildValidInput({ nationalIdIssuePlace: '' }),
      );
      expect(result.success).toBe(true);
    });

    it('accepts normal location text', () => {
      const result = createCustomerSchema.safeParse(
        buildValidInput({ nationalIdIssuePlace: 'Công an TP. Hồ Chí Minh' }),
      );
      expect(result.success).toBe(true);
    });

    it('rejects text exceeding 200 characters', () => {
      const longText = 'A'.repeat(201);
      const result = createCustomerSchema.safeParse(
        buildValidInput({ nationalIdIssuePlace: longText }),
      );
      expect(result.success).toBe(false);
    });

    it('accepts text at exactly 200 characters', () => {
      const exactText = 'A'.repeat(200);
      const result = createCustomerSchema.safeParse(
        buildValidInput({ nationalIdIssuePlace: exactText }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('round-trip persistence', () => {
    it('all 3 CCCD fields survive parse → data round-trip', () => {
      const input = buildValidInput({
        nationalIdNumber: '001234567890',
        nationalIdIssueDate: '2021-06-15',
        nationalIdIssuePlace: 'Công an Hà Nội',
      });
      const result = createCustomerSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nationalIdNumber).toBe('001234567890');
        expect(result.data.nationalIdIssueDate).toBe('2021-06-15');
        expect(result.data.nationalIdIssuePlace).toBe('Công an Hà Nội');
      }
    });

    it('empty CCCD fields round-trip as empty strings', () => {
      const input = buildValidInput({
        nationalIdNumber: '',
        nationalIdIssueDate: '',
        nationalIdIssuePlace: '',
      });
      const result = createCustomerSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nationalIdNumber).toBe('');
        expect(result.data.nationalIdIssueDate).toBe('');
        expect(result.data.nationalIdIssuePlace).toBe('');
      }
    });
  });

  describe('updateCustomerSchema', () => {
    it('allows partial CCCD fields (all optional)', () => {
      const result = updateCustomerSchema.safeParse({
        nationalIdNumber: '123456789',
      });
      expect(result.success).toBe(true);
    });

    it('still validates nationalIdNumber pattern in update schema', () => {
      const result = updateCustomerSchema.safeParse({
        nationalIdNumber: '12345', // 5 digits — invalid
      });
      expect(result.success).toBe(false);
    });
  });
});
