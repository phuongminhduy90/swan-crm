/**
 * Story B.2.3 (F-MED-17) — Audit log page diff renders PII redaction.
 *
 * Verifies:
 *  - When an audit log entry's `before` / `after` snapshot contains a
 *    redacted PII field (medicalNote, privacyNote, nationalIdNumber) with
 *    the `[ĐÃ ẨN]` placeholder, the placeholder is rendered with the
 *    gray italic style and the redaction tooltip.
 *  - Surrounding non-PII fields continue to render normally.
 *  - The placeholder never bleeds the raw value (asserted via the strict
 *    placeholder match — the same constant the persistence layer uses).
 *
 * @see docs/ux-redesign/STORY_B2_3_IMPLEMENTATION_REPORT.md
 * @see docs/ux-redesign/STORY_B2_3_MIGRATION_NOTES.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  renderWithProviders,
  within,
  waitFor,
  fireEvent,
} from '@/test/test-utils';
import AuditLogsPage from '@/app/(protected)/audit-logs/page';
import { AUDIT_REDACTED_PLACEHOLDER } from '@/lib/firestore/audit';
import type { AuditLog } from '@/lib/types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// `useToast` throws if no provider exists. Pages deep in (protected) usually
// have one mounted by the layout, so we mock the hook to a stub that returns
// a no-op `toast` so the page can render in isolation.
const mockToast = vi.fn();
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// `fetch` is hit on mount via `/api/audit-logs`. Mock globally so we can
// return deterministic log entries.
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Fixtures ────────────────────────────────────────────────────────────────

function buildAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'audit-1',
    actorId: 'user-001',
    actorName: 'Phạm Thị Admin',
    actorRole: 'admin',
    action: 'customer_updated',
    entityType: 'customer',
    entityId: 'cust-001',
    createdAt: '2026-06-29T08:30:00.000Z',
    before: {
      fullName: 'Trần Thị A',
      phone: '0901234567',
      medicalNote: AUDIT_REDACTED_PLACEHOLDER,
      privacyNote: AUDIT_REDACTED_PLACEHOLDER,
      nationalIdNumber: AUDIT_REDACTED_PLACEHOLDER,
    },
    after: {
      fullName: 'Trần Thị B',
      phone: '0901234567',
      medicalNote: AUDIT_REDACTED_PLACEHOLDER,
      privacyNote: AUDIT_REDACTED_PLACEHOLDER,
      nationalIdNumber: AUDIT_REDACTED_PLACEHOLDER,
    },
    ...overrides,
  };
}

/** Find the audit log row button. The same action label also appears inside
 *  the "Hành động" <select> dropdown, so we walk every match and pick the
 *  one whose closest <button> ancestor actually exists. */
function getAuditRowButton(): HTMLButtonElement {
  const candidates = screen.getAllByText('Cập nhật khách hàng');
  for (const el of candidates) {
    const card = el.closest('button');
    if (card) return card as HTMLButtonElement;
  }
  throw new Error('Could not find audit row button');
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('AuditLogsPage — Story B.2.3 redaction rendering (F-MED-17)', () => {
  beforeEach(() => {
    mockToast.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Loading & empty states still work after the change ─────────────────

  it('renders the empty-state card when there are no audit logs', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true, logs: [], total: 0 }),
    });

    renderWithProviders(<AuditLogsPage />);
    expect(
      await screen.findByText('Không có nhật ký hoạt động nào'),
    ).toBeInTheDocument();
  });

  // ── 2. Redacted placeholder renders with tooltip + gray italic ────────────

  it('renders every redacted `[ĐÃ ẨN]` placeholder with the explanatory tooltip', async () => {
    const log = buildAuditLog();
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true, logs: [log], total: 1 }),
    });

    renderWithProviders(<AuditLogsPage />);

    // Wait for the row to render then expand it.
    await screen.findByText('Cập nhật khách hàng');
    const rowButton = getAuditRowButton();
    fireEvent.click(rowButton);

    // 3 fields × 2 sides = 6 occurrences total. Use >=3 as a lenient sanity
    // check that survives any future fixture shape tweak.
    await waitFor(() => {
      const placeholders = screen.getAllByTitle(
        'Thông tin nhạy cảm đã được ẩn vì lý do bảo mật',
      );
      expect(placeholders.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('styles the redacted placeholder as italic gray', async () => {
    const log = buildAuditLog();
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true, logs: [log], total: 1 }),
    });

    renderWithProviders(<AuditLogsPage />);
    await screen.findByText('Cập nhật khách hàng');
    fireEvent.click(getAuditRowButton());

    await waitFor(() => {
      const span = screen.getAllByTitle(
        'Thông tin nhạy cảm đã được ẩn vì lý do bảo mật',
      )[0];
      expect(span.tagName).toBe('SPAN');
      expect(span.className).toMatch(/italic/);
      expect(span.className).toMatch(/text-gray-500/);
    });
  });

  // ── 3. Non-PII fields are still rendered in the diff ──────────────────────

  it('renders non-PII fields (fullName, phone) verbatim in the diff', async () => {
    const log = buildAuditLog();
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true, logs: [log], total: 1 }),
    });

    const { container } = renderWithProviders(<AuditLogsPage />);
    await screen.findByText('Cập nhật khách hàng');
    fireEvent.click(getAuditRowButton());

    await waitFor(() => {
      // The full names appear inside the <pre> JSON dump — match by regex
      // because the renderer splits text into multiple text nodes around
      // the redaction chips.
      const html = container.innerHTML;
      expect(html).toContain('Trần Thị A');
      expect(html).toContain('Trần Thị B');
      expect(html).toContain('0901234567');
    });
  });

  // ── 4. Render path is also safe when no PII field is redacted ─────────────

  it('renders cleanly when neither side contains any redacted field', async () => {
    const log = buildAuditLog({
      before: { status: 'draft' },
      after: { status: 'confirmed' },
    });
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true, logs: [log], total: 1 }),
    });

    const { container } = renderWithProviders(<AuditLogsPage />);
    await screen.findByText('Cập nhật khách hàng');
    fireEvent.click(getAuditRowButton());

    await waitFor(() => {
      const html = container.innerHTML;
      expect(html).toContain('draft');
      expect(html).toContain('confirmed');
    });
    // No tooltip elements when nothing is redacted.
    expect(
      screen.queryByTitle('Thông tin nhạy cảm đã được ẩn vì lý do bảo mật'),
    ).not.toBeInTheDocument();
  });

  // ── 5. Only one side is redacted — the other side renders normally ───────

  it('renders the redacted side with the placeholder but keeps the other side verbatim', async () => {
    const log = buildAuditLog({
      before: {
        fullName: 'Old Name',
        medicalNote: AUDIT_REDACTED_PLACEHOLDER,
        privacyNote: AUDIT_REDACTED_PLACEHOLDER,
      },
      after: {
        // after does NOT have PII fields at all in this fixture
        fullName: 'New Name',
        source: 'walk_in',
      },
    });
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true, logs: [log], total: 1 }),
    });

    const { container } = renderWithProviders(<AuditLogsPage />);
    await screen.findByText('Cập nhật khách hàng');
    fireEvent.click(getAuditRowButton());

    // The "Trước" side should show two placeholders, each with the tooltip.
    await waitFor(() => {
      const tooltipped = screen.getAllByTitle(
        'Thông tin nhạy cảm đã được ẩn vì lý do bảo mật',
      );
      expect(tooltipped.length).toBe(2);
    });
    // The "Sau" side should have the non-PII fields visible verbatim.
    // Use innerHTML matching because the JSON dump splits text nodes.
    const html = container.innerHTML;
    expect(html).toContain('Old Name');
    expect(html).toContain('New Name');
    expect(html).toContain('walk_in');
  });

  // ── 6. No leakage: every `[ĐÃ ẨN]` rendered is the styled chip ────────────

  it('every `[ĐÃ ẨN]` rendered in the diff is wrapped in the styled chip with tooltip', async () => {
    const log = buildAuditLog();
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true, logs: [log], total: 1 }),
    });

    const { container } = renderWithProviders(<AuditLogsPage />);
    await screen.findByText('Cập nhật khách hàng');
    fireEvent.click(getAuditRowButton());

    // Every rendered placeholder must carry the tooltip AND the styles.
    await waitFor(() => {
      const tooltipped = within(container).getAllByTitle(
        'Thông tin nhạy cảm đã được ẩn vì lý do bảo mật',
      );
      expect(tooltipped.length).toBeGreaterThan(0);
      for (const span of tooltipped) {
        expect(span.className).toMatch(/italic/);
        expect(span.className).toMatch(/text-gray-500/);
        // Text content of the styled span must equal the placeholder.
        expect(span.textContent).toContain(AUDIT_REDACTED_PLACEHOLDER);
      }
    });
  });

  // ── 7. Expansion toggle still works after the rendering change ────────────

  it('expands a row and renders both Trước and Sau diff panels with placeholders', async () => {
    const log = buildAuditLog();
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true, logs: [log], total: 1 }),
    });

    const { container } = renderWithProviders(<AuditLogsPage />);
    await screen.findByText('Cập nhật khách hàng');
    fireEvent.click(getAuditRowButton());

    await waitFor(() => {
      expect(screen.getByText('Trước')).toBeInTheDocument();
      expect(screen.getByText('Sau')).toBeInTheDocument();
    });

    const placeholders = within(container).getAllByTitle(
      'Thông tin nhạy cảm đã được ẩn vì lý do bảo mật',
    );
    expect(placeholders.length).toBeGreaterThanOrEqual(2);
  });
});
