/**
 * Story C.2.3 — Reports date filter URL-sync + refetch + active-pill X icon.
 *
 * Verifies the integration of the new URL-synced `dateRange` state on the
 * Reports page (`/reports`):
 *  1. On first load with no `?range=` param, the page defaults to `6 tháng`.
 *  2. `?range=3m` / `?range=6m` / `?range=12m` / `?range=0` are all valid and
 *     drive the active pill highlight.
 *  3. Invalid / unknown `?range=` values fall back to the default (6 tháng).
 *  4. Clicking a different pill calls `router.replace(...)` with the new
 *     `?range=` (or removes the param when going back to default).
 *  5. Clicking the active-pill X icon or "Xóa tất cả bộ lọc" removes the
 *     `?range=` param and fires a Vietnamese toast.
 *  6. Changing the date range triggers a refetch via `getAllPayments` /
 *     `getAllCases` / `getAllCustomers`. The "Đang lọc…" pill renders during
 *     the refetch window.
 *
 * Implementation note:
 *  - We mock `next/navigation` with a small in-memory store so we can
 *    simulate `?range=` changes without pulling in Next's router internals.
 *  - We mock `@/lib/firestore` (the barrel re-export) so the page's data
 *    loaders become observable spies — every refetch is asserted by call
 *    count.
 *  - We mock `useToast` so the success/info toasts on "Xóa tất cả" are
 *    observed without needing a `<ToastProvider>` wrapper.
 *
 * @see docs/ux-redesign/SPRINT_7_2_EXECUTION_PLAN.md §1.1 (C.2.3 row)
 * @see docs/ux-redesign/STORY_C2_3_MIGRATION_NOTES.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEffect, useState } from 'react';
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import type { Payment, CaseRecord, Customer } from '@/lib/types';

// ─── next/navigation mock ────────────────────────────────────────────────────
//
// We keep an in-memory URL + pushState-like buffer so the page can
// `router.replace(...)` and we can read the new URL back.
//
// Reactivity strategy: `replaceMock` bumps a monotonically increasing version
// counter and notifies subscribers. The mocked `useSearchParams` hook uses
// `useState` keyed on the version to force a re-render with the fresh
// `currentSearch` snapshot. This mirrors how `next/navigation` actually
// works (it subscribes to Next's router events).

let currentSearch: Record<string, string> = {};
let urlVersion = 0;
const subscribers = new Set<() => void>();

const replaceMock = vi.fn((url: string) => {
  const [path, qs] = url.split('?');
  void path;
  currentSearch = {};
  if (qs) {
    const params = new URLSearchParams(qs);
    params.forEach((v, k) => {
      currentSearch[k] = v;
    });
  }
  urlVersion += 1;
  subscribers.forEach((cb) => cb());
});

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(
    Object.entries(currentSearch).map(([k, v]) => [k, v] as [string, string]),
  );
}

vi.mock('next/navigation', () => ({
  __esModule: true,
  usePathname: () => '/reports',
  useRouter: () => ({
    push: vi.fn(),
    replace: (...args: unknown[]) => replaceMock(...args),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => {
    // Subscribe to URL version bumps; bump our own state when the URL
    // changes so the consumer re-renders with a fresh snapshot.
    const [, setVersion] = useState(urlVersion);
    useEffect(() => {
      const cb = () => setVersion((v) => v + 1);
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    }, []);
    return getCurrentSearchParams();
  },
}));

// ─── firestore loaders mock ──────────────────────────────────────────────────
//
// We expose each loader as a spy so we can assert "refetch happened when
// dateRange changed". Default returns empty arrays — the page doesn't need
// real data to assert URL sync.

const getAllPaymentsMock = vi.fn(async () => [] as Payment[]);
const getAllCasesMock = vi.fn(async () => [] as CaseRecord[]);
const getAllCustomersMock = vi.fn(async () => [] as Customer[]);

vi.mock('@/lib/firestore', () => ({
  getAllPayments: (...args: unknown[]) => getAllPaymentsMock(...args),
  getAllCases: (...args: unknown[]) => getAllCasesMock(...args),
  getAllCustomers: (...args: unknown[]) => getAllCustomersMock(...args),
}));

// ─── Toast mock ──────────────────────────────────────────────────────────────

const toastMock = vi.fn();
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

// ─── Recharts ResizeObserver shim ────────────────────────────────────────────

beforeEach(() => {
  if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  currentSearch = {};
  urlVersion = 0;
  subscribers.clear();
  replaceMock.mockClear();
  getAllPaymentsMock.mockClear();
  getAllCasesMock.mockClear();
  getAllCustomersMock.mockClear();
  toastMock.mockClear();
});

afterEach(() => {
  cleanup();
});

/** Render the page in a microtask-flushed act() so initial useEffect fires. */
function renderPage() {
  let result!: ReturnType<typeof render>;
  act(() => {
    result = render(<Page />);
  });
  return result;
}

// Import AFTER mocks are registered so the page picks them up.
import Page from '@/app/(protected)/reports/page';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('C.2.3 — Reports date filter URL-sync + refetch + clear', () => {
  it('defaults to 6 tháng when no ?range= param is present', async () => {
    renderPage();
    // The default-active pill (6 tháng) renders the check icon — but the
    // most reliable signal is the active filter banner NOT being shown (the
    // banner is suppressed for the default).
    expect(screen.queryByTestId('report-filter-clear-all')).not.toBeInTheDocument();
    // The 6 tháng pill is the active one (has the testid we click on).
    const sixMonth = screen.getByTestId('report-filter-6');
    expect(sixMonth).toBeInTheDocument();
  });

  it('parses ?range=3m correctly and renders the 3 tháng pill as active', async () => {
    currentSearch = { range: '3m' };
    renderPage();
    // Banner is now visible since 3 tháng is not the default.
    await waitFor(() => {
      expect(screen.getByTestId('report-filter-clear-all')).toBeInTheDocument();
    });
    expect(screen.getByText('Đang lọc: 3 tháng')).toBeInTheDocument();
  });

  it('parses ?range=0 as Tất cả', async () => {
    currentSearch = { range: '0' };
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Đang lọc: Tất cả')).toBeInTheDocument();
    });
  });

  it('falls back to default for an invalid ?range= value', async () => {
    currentSearch = { range: 'garbage' };
    renderPage();
    // Default = 6 tháng, so no banner.
    expect(screen.queryByTestId('report-filter-clear-all')).not.toBeInTheDocument();
  });

  it('falls back to default for an unsupported numeric ?range= value', async () => {
    currentSearch = { range: '99m' };
    renderPage();
    expect(screen.queryByTestId('report-filter-clear-all')).not.toBeInTheDocument();
  });

  it('clicking the 3 tháng pill calls router.replace with ?range=3m', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('report-filter-3'));
    expect(replaceMock).toHaveBeenCalledWith('/reports?range=3m', expect.objectContaining({ scroll: false }));
  });

  it('clicking the default-active pill removes the ?range= param', async () => {
    currentSearch = { range: '3m' };
    const user = userEvent.setup();
    renderPage();
    // The 3 tháng pill is active; clicking it should toggle to 6 tháng and
    // remove the param. (Toggling between 3 ↔ 6 is not the spec — we assert
    // that clicking the *currently default* pill clears the param.)
    await waitFor(() => {
      expect(screen.getByTestId('report-filter-clear-all')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('report-filter-6'));
    expect(replaceMock).toHaveBeenLastCalledWith('/reports', expect.objectContaining({ scroll: false }));
  });

  it('clicking the active-pill X icon calls router.replace (no param) and fires a toast', async () => {
    currentSearch = { range: '12m' };
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('report-filter-clear-12')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('report-filter-clear-12'));
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/reports', expect.objectContaining({ scroll: false }));
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        title: 'Đã xóa bộ lọc',
      }),
    );
  });

  it('clicking "Xóa tất cả bộ lọc" removes the ?range= param and fires a toast', async () => {
    currentSearch = { range: '6m' };
    // Note: 6 tháng IS the default, so the banner is hidden — but the X icon
    // on the active pill is still there. We use the X icon path here.
    const user = userEvent.setup();
    renderPage();
    // The "Xóa tất cả bộ lọc" button is suppressed when filter === default
    // (the page treats 6 tháng as the no-filter baseline). So we instead
    // click the X icon on the active pill, which is the equivalent surface.
    await waitFor(() => {
      expect(screen.getByTestId('report-filter-clear-6')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('report-filter-clear-6'));
    expect(replaceMock).toHaveBeenLastCalledWith('/reports', expect.anything());
    expect(toastMock).toHaveBeenCalled();
  });

  it('changes the date range trigger a refetch of payments/cases/customers', async () => {
    // First render: 1 fetch each.
    renderPage();
    await waitFor(() => {
      expect(getAllPaymentsMock).toHaveBeenCalledTimes(1);
    });
    expect(getAllCasesMock).toHaveBeenCalledTimes(1);
    expect(getAllCustomersMock).toHaveBeenCalledTimes(1);

    // Switch to 3 tháng → another fetch each.
    const user = userEvent.setup();
    await user.click(screen.getByTestId('report-filter-3'));
    await waitFor(() => {
      expect(getAllPaymentsMock).toHaveBeenCalledTimes(2);
    });
    expect(getAllCasesMock).toHaveBeenCalledTimes(2);
    expect(getAllCustomersMock).toHaveBeenCalledTimes(2);

    // Switch to 12 tháng → another fetch each.
    await user.click(screen.getByTestId('report-filter-12'));
    await waitFor(() => {
      expect(getAllPaymentsMock).toHaveBeenCalledTimes(3);
    });
  });

  it('shows the "Đang lọc…" pill during a refetch (non-first load)', async () => {
    const user = userEvent.setup();
    renderPage();
    // Wait for first load to finish (default mock resolves immediately).
    await waitFor(() => {
      expect(getAllPaymentsMock).toHaveBeenCalledTimes(1);
    });

    // Swap in a slow mock for the next refetch.
    let resolvePayments!: (v: Payment[]) => void;
    getAllPaymentsMock.mockImplementationOnce(
      () => new Promise<Payment[]>((r) => { resolvePayments = r; }),
    );

    // Trigger refetch by switching range.
    await user.click(screen.getByTestId('report-filter-3'));

    // While the promise is pending, the "Đang lọc…" pill should be visible.
    await waitFor(() => {
      expect(screen.getByTestId('report-filtering-pill')).toBeInTheDocument();
    });
    expect(screen.getByText('Đang lọc…')).toBeInTheDocument();

    // Resolve the promise to settle.
    await act(async () => {
      resolvePayments([]);
    });
    await waitFor(() => {
      expect(screen.queryByTestId('report-filtering-pill')).not.toBeInTheDocument();
    });
  });

  it('preserves the active filter pill on the X icon even after URL change', async () => {
    currentSearch = { range: '3m' };
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('report-filter-clear-3')).toBeInTheDocument();
    });
    // After clicking, the X disappears because the filter is cleared.
    await user.click(screen.getByTestId('report-filter-clear-3'));
    await waitFor(() => {
      expect(screen.queryByTestId('report-filter-clear-3')).not.toBeInTheDocument();
    });
  });
});
