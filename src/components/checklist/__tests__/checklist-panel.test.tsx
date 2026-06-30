/**
 * Story B.2.1 (F-CRIT-03) — Render tests for ChecklistPanel.
 *
 * Verifies:
 *   1. 6 clinical items render when `FEATURE_CLINICAL_CHECKLIST` is ON
 *   2. 6 clinical items are HIDDEN when the flag is OFF (regression baseline)
 *   3. Badge subline "X mục lâm sàng còn thiếu" appears when applicable
 *   4. Badge shows passed state when all clinical complete
 *   5. Flag-combination warning logs when CLINICAL_CHECKLIST=OFF + CHECKLIST_GATE=ON
 *
 * @see docs/ux-redesign/STORY_B2_1_EXECUTION_PLAN.md §7.2.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockEvaluatePreHospital = vi.fn();
const mockEvaluatePreProcedure = vi.fn();

vi.mock('@/lib/checklist', () => ({
  evaluatePreHospitalChecklist: (...args: unknown[]) => mockEvaluatePreHospital(...args),
  evaluatePreProcedureChecklist: (...args: unknown[]) => mockEvaluatePreProcedure(...args),
  CLINICAL_ITEM_KEYS: [
    'blood_test_result',
    'allergy_declared',
    'pregnancy_test_done',
    'anesthesia_review_complete',
    'fasting_compliant',
    'treatment_consent_signed',
  ],
}));

// Dynamic import AFTER mocks so the panel module picks up the mocked
// `@/lib/checklist` re-exports.
import { ChecklistPanel } from '@/components/checklist/checklist-panel';
import type { ChecklistItem } from '@/lib/checklist';

const LEGACY_PASSING: ChecklistItem[] = [
  { key: 'lab_done', label: 'Xét nghiệm đã hoàn tất', passed: true, required: true },
  { key: 'doctor_approved', label: 'Bác sĩ đã duyệt', passed: true, required: true },
  { key: 'reminder_sent', label: 'Khách đã được nhắc lịch', passed: true, required: true },
  { key: 'hospital_confirmed', label: 'Bệnh viện đã xác nhận', passed: true, required: false },
  { key: 'nurse_assigned', label: 'Điều dưỡng đã được phân công', passed: true, required: true },
  { key: 'cskh_assigned', label: 'CSKH hậu phẫu đã được phân công', passed: true, required: true },
];

const CLINICAL_LABELS: Record<string, string> = {
  blood_test_result: 'Có kết quả xét nghiệm máu',
  allergy_declared: 'Đã khai báo dị ứng',
  pregnancy_test_done: 'Xét nghiệm thai (nếu áp dụng)',
  anesthesia_review_complete: 'Bác sĩ gây mê đã khám',
  fasting_compliant: 'Nhịn ăn/uống đúng quy định',
  treatment_consent_signed: 'Đã ký cam kết điều trị',
};

function buildClinicalItems(passedCount: number): ChecklistItem[] {
  const all = Object.keys(CLINICAL_LABELS);
  return all.map((key, idx) => ({
    key,
    label: CLINICAL_LABELS[key],
    passed: idx < passedCount,
    required: true,
  }));
}

describe('Story B.2.1 — ChecklistPanel (FEATURE_CLINICAL_CHECKLIST)', () => {
  const ORIGINAL_ENV = process.env;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env each test so flag values don't leak across tests.
    process.env = { ...ORIGINAL_ENV };
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    warnSpy.mockRestore();
  });

  it('renders 6 clinical items when FEATURE_CLINICAL_CHECKLIST is ON', async () => {
    process.env.NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST = 'true';
    mockEvaluatePreProcedure.mockResolvedValue({
      items: [...LEGACY_PASSING, ...buildClinicalItems(6)],
      allPassed: true,
    });
    render(<ChecklistPanel caseId="case-001" type="pre_procedure" />);
    await waitFor(() => {
      expect(screen.getByText(CLINICAL_LABELS.blood_test_result)).toBeInTheDocument();
    });
    expect(screen.getByText(CLINICAL_LABELS.allergy_declared)).toBeInTheDocument();
    expect(screen.getByText(CLINICAL_LABELS.pregnancy_test_done)).toBeInTheDocument();
    expect(screen.getByText(CLINICAL_LABELS.anesthesia_review_complete)).toBeInTheDocument();
    expect(screen.getByText(CLINICAL_LABELS.fasting_compliant)).toBeInTheDocument();
    expect(screen.getByText(CLINICAL_LABELS.treatment_consent_signed)).toBeInTheDocument();
  });

  it('HIDES the 6 clinical items when FEATURE_CLINICAL_CHECKLIST is OFF (regression baseline)', async () => {
    delete process.env.NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST;
    mockEvaluatePreProcedure.mockResolvedValue({
      items: [...LEGACY_PASSING, ...buildClinicalItems(0)],
      allPassed: true,
    });
    render(<ChecklistPanel caseId="case-001" type="pre_procedure" />);
    await waitFor(() => {
      expect(screen.getByText('Bác sĩ đã duyệt')).toBeInTheDocument();
    });
    for (const label of Object.values(CLINICAL_LABELS)) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('badge shows "X mục lâm sàng còn thiếu" subline when clinical items are incomplete', async () => {
    process.env.NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST = 'true';
    // 3 of 6 clinical items pass, so 3 remain incomplete.
    mockEvaluatePreProcedure.mockResolvedValue({
      items: [...LEGACY_PASSING, ...buildClinicalItems(3)],
      allPassed: false,
    });
    render(<ChecklistPanel caseId="case-001" type="pre_procedure" />);
    await waitFor(() => {
      expect(screen.getByText(/3 mục lâm sàng còn thiếu/)).toBeInTheDocument();
    });
  });

  it('badge does NOT show subline when all clinical items pass', async () => {
    process.env.NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST = 'true';
    mockEvaluatePreProcedure.mockResolvedValue({
      items: [...LEGACY_PASSING, ...buildClinicalItems(6)],
      allPassed: true,
    });
    render(<ChecklistPanel caseId="case-001" type="pre_procedure" />);
    await waitFor(() => {
      expect(screen.getByText('Đạt yêu cầu')).toBeInTheDocument();
    });
    expect(screen.queryByText(/mục lâm sàng còn thiếu/)).not.toBeInTheDocument();
  });

  it('badge subline does NOT appear when CLINICAL_CHECKLIST is OFF even if items are incomplete', async () => {
    delete process.env.NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST;
    mockEvaluatePreProcedure.mockResolvedValue({
      items: [...LEGACY_PASSING, ...buildClinicalItems(0)],
      allPassed: true,
    });
    render(<ChecklistPanel caseId="case-001" type="pre_procedure" />);
    await waitFor(() => {
      expect(screen.getByText('Đạt yêu cầu')).toBeInTheDocument();
    });
    expect(screen.queryByText(/mục lâm sàng còn thiếu/)).not.toBeInTheDocument();
  });

  it('logs a console warning when CLINICAL_CHECKLIST=OFF + CHECKLIST_GATE=ON (forbidden combo)', async () => {
    delete process.env.NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST;
    process.env.NEXT_PUBLIC_FEATURE_CHECKLIST_GATE = 'true';
    mockEvaluatePreProcedure.mockResolvedValue({
      items: [...LEGACY_PASSING, ...buildClinicalItems(6)],
      allPassed: false,
    });
    render(<ChecklistPanel caseId="case-001" type="pre_procedure" />);
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Inconsistent flag combination'),
      );
    });
  });

  it('does NOT log the warning when both flags are ON (consistent state)', async () => {
    process.env.NEXT_PUBLIC_FEATURE_CLINICAL_CHECKLIST = 'true';
    process.env.NEXT_PUBLIC_FEATURE_CHECKLIST_GATE = 'true';
    mockEvaluatePreProcedure.mockResolvedValue({
      items: [...LEGACY_PASSING, ...buildClinicalItems(6)],
      allPassed: true,
    });
    render(<ChecklistPanel caseId="case-001" type="pre_procedure" />);
    await waitFor(() => {
      expect(screen.getByText('Đạt yêu cầu')).toBeInTheDocument();
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});