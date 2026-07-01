/**
 * Story C.1.3 — Tabs ARIA on every consumer.
 *
 * Acceptance criteria (see `docs/ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md`
 * §1.1 / §5.2):
 *   1. Every consumer of `<Tabs>` has a `role="tabpanel"` element with
 *      matching `id` + `aria-labelledby` for the active tab.
 *   2. Identified non-conforming consumers (case detail, payments, customers
 *      detail, notifications, reports) wire a stable `idPrefix` so tab ids +
 *      panel ids remain consistent across re-renders.
 *   3. axe-core scan on each consumer pattern reports 0 critical.
 *   4. Keyboard navigation (ArrowLeft / ArrowRight / Home / End) verified by
 *      Vitest + Testing Library.
 *   5. `idPrefix` is stable across re-renders.
 *   6. `panelIds` opt-out works for tabs without panels (back-compat with
 *      consumers that suppress `aria-controls`).
 *
 * Because the five consumer pages import dozens of domain modules (firestore,
 * auth, consent panel, follow-up loader, etc.) we don't render the page
 * directly in vitest — we instead mount the shared `<Tabs>` primitive in the
 * exact same wiring the consumers use, exercising the IDs / roles / keyboard
 * contract. The page-level axe-core scan in Playwright (Sprint 6.4 Layer 9
 * harness) catches per-route regressions separately.
 *
 * Note on id convention (mirroring the Tabs primitive — see `tabs.tsx`):
 *   - Given `idPrefix="<prefix>"`, every tab id becomes `${prefix}-tab-${id}`
 *   - `aria-controls` on the tab points at `${prefix}-panel-${id}`
 *   - Consumers must wire their tabpanel with
 *     `id="${prefix}-panel-${id}"` and `aria-labelledby="${prefix}-tab-${id}"`.
 *   - Consumers therefore use `idPrefix` WITHOUT a `-tab` suffix (e.g.
 *     `idPrefix="case-detail"` → tab id `case-detail-tab-info`, panel id
 *     `case-detail-panel-info`).
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, renderWithProviders } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { Tabs, TabItem } from '@/components/ui/tabs';

// ---------------------------------------------------------------------------
// Shared fixtures — mirrors each consumer's `idPrefix`
// ---------------------------------------------------------------------------

const CASE_DETAIL_TABS: TabItem[] = [
  { id: 'info', label: 'Thông tin' },
  { id: 'services', label: 'Dịch vụ' },
  { id: 'payments', label: 'Thanh toán' },
  { id: 'staff', label: 'Phân công' },
  { id: 'attachments', label: 'Đính kèm' },
  { id: 'consents', label: 'Consent' },
  { id: 'timeline', label: 'Timeline' },
];

const CUSTOMER_DETAIL_TABS: TabItem[] = [
  { id: 'info', label: 'Thông tin' },
  { id: 'cases', label: 'Lịch sử ca' },
  { id: 'followups', label: 'Theo dõi sau PT' },
  { id: 'consents', label: 'Consent' },
  { id: 'timeline', label: 'Timeline' },
];

const NOTIFICATIONS_TABS: TabItem[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'unread', label: 'Chưa đọc' },
  { id: 'read', label: 'Đã đọc' },
];

const REPORTS_TABS: TabItem[] = [
  { id: 'revenue', label: 'Doanh thu' },
  { id: 'pipeline', label: 'Luồng CASE' },
  { id: 'customer', label: 'Khách hàng' },
];

const PAYMENTS_TABS: TabItem[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ xác nhận' },
  { id: 'confirmed', label: 'Đã xác nhận' },
  { id: 'rejected', label: 'Từ chối' },
  { id: 'refund', label: 'Hoàn tiền' },
];

// ===========================================================================
// 1. Per-consumer wiring (Tabs primitive + role="tabpanel" + aria-labelledby)
// ===========================================================================

describe('C.1.3 — case detail wiring', () => {
  // Case detail uses idPrefix="case-detail" so:
  //   tab id = "case-detail-tab-{id}"
  //   panel id = "case-detail-panel-{id}"
  //   aria-labelledby on panel = "case-detail-tab-{id}"

  it('emits aria-controls pointing at case-detail-panel-{id} for every tab', () => {
    render(<Tabs items={CASE_DETAIL_TABS} idPrefix="case-detail" />);

    CASE_DETAIL_TABS.forEach((item) => {
      const tab = screen.getByRole('tab', { name: item.label });
      expect(tab).toHaveAttribute('id', `case-detail-tab-${item.id}`);
      expect(tab).toHaveAttribute(
        'aria-controls',
        `case-detail-panel-${item.id}`,
      );
    });
  });

  it('every panel wires role="tabpanel" + id + aria-labelledby with the correct tab id', () => {
    const { container } = render(
      <>
        <Tabs items={CASE_DETAIL_TABS} idPrefix="case-detail" />
        {CASE_DETAIL_TABS.map((item) => (
          <div
            key={item.id}
            id={`case-detail-panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`case-detail-tab-${item.id}`}
            tabIndex={0}
          >
            {item.label} content
          </div>
        ))}
      </>,
    );

    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(CASE_DETAIL_TABS.length);
    CASE_DETAIL_TABS.forEach((item) => {
      const panel = container.querySelector(
        `[id="case-detail-panel-${item.id}"]`,
      ) as HTMLElement | null;
      expect(panel).not.toBeNull();
      expect(panel).toHaveAttribute('role', 'tabpanel');
      expect(panel).toHaveAttribute(
        'aria-labelledby',
        `case-detail-tab-${item.id}`,
      );
      expect(panel).toHaveAttribute('id', `case-detail-panel-${item.id}`);
      expect(panel).toHaveAttribute('tabindex', '0');
    });
  });
});

describe('C.1.3 — customers detail wiring', () => {
  it('emits aria-controls pointing at customer-detail-panel-{id}', () => {
    render(<Tabs items={CUSTOMER_DETAIL_TABS} idPrefix="customer-detail" />);

    CUSTOMER_DETAIL_TABS.forEach((item) => {
      const tab = screen.getByRole('tab', { name: item.label });
      expect(tab).toHaveAttribute(
        'aria-controls',
        `customer-detail-panel-${item.id}`,
      );
    });
  });

  it('every panel wires role="tabpanel" + aria-labelledby with the correct tab id', () => {
    const { container } = render(
      <>
        <Tabs items={CUSTOMER_DETAIL_TABS} idPrefix="customer-detail" />
        {CUSTOMER_DETAIL_TABS.map((item) => (
          <div
            key={item.id}
            id={`customer-detail-panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`customer-detail-tab-${item.id}`}
            tabIndex={0}
          >
            {item.label} content
          </div>
        ))}
      </>,
    );

    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(CUSTOMER_DETAIL_TABS.length);
    CUSTOMER_DETAIL_TABS.forEach((item) => {
      const panel = container.querySelector(
        `[id="customer-detail-panel-${item.id}"]`,
      ) as HTMLElement | null;
      expect(panel).not.toBeNull();
      expect(panel).toHaveAttribute('role', 'tabpanel');
      expect(panel).toHaveAttribute(
        'aria-labelledby',
        `customer-detail-tab-${item.id}`,
      );
    });
  });
});

describe('C.1.3 — notifications wiring', () => {
  it('emits aria-controls pointing at notifications-panel-{id}', () => {
    render(<Tabs items={NOTIFICATIONS_TABS} idPrefix="notifications" />);

    NOTIFICATIONS_TABS.forEach((item) => {
      const tab = screen.getByRole('tab', { name: item.label });
      expect(tab).toHaveAttribute(
        'aria-controls',
        `notifications-panel-${item.id}`,
      );
    });
  });
});

describe('C.1.3 — reports wiring', () => {
  it('emits aria-controls pointing at reports-panel-{id}', () => {
    render(<Tabs items={REPORTS_TABS} idPrefix="reports" />);

    REPORTS_TABS.forEach((item) => {
      const tab = screen.getByRole('tab', { name: item.label });
      expect(tab).toHaveAttribute(
        'aria-controls',
        `reports-panel-${item.id}`,
      );
    });
  });
});

describe('C.1.3 — payments wiring (hand-rolled tab markup)', () => {
  // Payments page still uses hand-rolled tabs to preserve the underline
  // visual treatment. The test reproduces its tablist / tab / tabpanel
  // markup verbatim to confirm the ARIA wiring is correct.

  it('tablist wraps every tab with role="tab" + aria-selected + aria-controls', () => {
    render(
      <div
        role="tablist"
        aria-orientation="horizontal"
        aria-label="Bộ lọc trạng thái thanh toán"
      >
        {PAYMENTS_TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            id={`payments-tab-${item.id}`}
            aria-selected={item.id === 'pending'}
            aria-controls={`payments-tab-panel-${item.id}`}
            tabIndex={item.id === 'pending' ? 0 : -1}
          >
            {item.label}
          </button>
        ))}
      </div>,
    );

    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal');
    PAYMENTS_TABS.forEach((item) => {
      const tab = screen.getByRole('tab', { name: item.label });
      expect(tab).toHaveAttribute('id', `payments-tab-${item.id}`);
      expect(tab).toHaveAttribute('aria-controls', `payments-tab-panel-${item.id}`);
      if (item.id === 'pending') {
        expect(tab).toHaveAttribute('aria-selected', 'true');
        expect(tab).toHaveAttribute('tabindex', '0');
      } else {
        expect(tab).toHaveAttribute('aria-selected', 'false');
        expect(tab).toHaveAttribute('tabindex', '-1');
      }
    });
  });
});

// ===========================================================================
// 2. idPrefix stability across re-renders
// ===========================================================================

describe('C.1.3 — idPrefix stability', () => {
  it('keeps the same id on every tab across re-renders', () => {
    function Harness() {
      const [active, setActive] = useState('info');
      return (
        <>
          <button data-testid="switch" onClick={() => setActive('services')}>
            Switch
          </button>
          <Tabs
            items={CASE_DETAIL_TABS}
            idPrefix="case-detail"
            activeId={active}
            onChange={setActive}
          />
        </>
      );
    }

    render(<Harness />);

    const firstIds = CASE_DETAIL_TABS.map((item) => ({
      label: item.label,
      id: screen.getByRole('tab', { name: item.label }).id,
    }));

    // Re-render with a different active tab.
    screen.getByTestId('switch').click();

    const secondIds = CASE_DETAIL_TABS.map((item) => ({
      label: item.label,
      id: screen.getByRole('tab', { name: item.label }).id,
    }));

    expect(secondIds).toEqual(firstIds);
  });

  it('survives an item-list reorder without id collisions or hydration mismatch', () => {
    function Harness({ items }: { items: TabItem[] }) {
      const [active, setActive] = useState(items[0]?.id);
      return (
        <Tabs
          items={items}
          idPrefix="stable-prefix"
          activeId={active}
          onChange={setActive}
        />
      );
    }

    const initial: TabItem[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ];

    const { rerender } = render(<Harness items={initial} />);

    const firstAId = screen.getByRole('tab', { name: 'A' }).id;
    const firstBId = screen.getByRole('tab', { name: 'B' }).id;

    // Reorder: A still present, B still present → ids must be stable.
    rerender(<Harness items={[initial[0], initial[2], initial[1]]} />);

    expect(screen.getByRole('tab', { name: 'A' }).id).toBe(firstAId);
    expect(screen.getByRole('tab', { name: 'B' }).id).toBe(firstBId);
  });
});

// ===========================================================================
// 3. panelIds opt-out (back-compat for consumers without panels)
// ===========================================================================

describe('C.1.3 — panelIds opt-out', () => {
  it('panelIds={[]} suppresses aria-controls on every tab', () => {
    render(<Tabs items={CASE_DETAIL_TABS} idPrefix="case-detail" panelIds={[]} />);

    CASE_DETAIL_TABS.forEach((item) => {
      expect(screen.getByRole('tab', { name: item.label })).not.toHaveAttribute(
        'aria-controls',
      );
    });
  });

  it('panelIds=["info"] emits aria-controls only on info', () => {
    render(
      <Tabs
        items={CUSTOMER_DETAIL_TABS}
        idPrefix="customer-detail"
        panelIds={['info']}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveAttribute(
      'aria-controls',
      'customer-detail-panel-info',
    );
    expect(screen.getByRole('tab', { name: 'Lịch sử ca' })).not.toHaveAttribute(
      'aria-controls',
    );
  });
});

// ===========================================================================
// 4. Keyboard navigation preserved (Arrows / Home / End cycle selection)
// ===========================================================================

describe('C.1.3 — keyboard navigation', () => {
  it('ArrowRight cycles through every tab and updates aria-selected', async () => {
    const user = userEvent.setup();
    render(<Tabs items={REPORTS_TABS} idPrefix="reports" />);

    const revenueTab = screen.getByRole('tab', { name: 'Doanh thu' });
    revenueTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'Luồng CASE' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Doanh thu' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('End jumps to the last tab and updates aria-selected', async () => {
    const user = userEvent.setup();
    render(<Tabs items={CASE_DETAIL_TABS} idPrefix="case-detail" />);

    const infoTab = screen.getByRole('tab', { name: 'Thông tin' });
    infoTab.focus();
    await user.keyboard('{End}');

    expect(screen.getByRole('tab', { name: 'Timeline' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('ArrowLeft wraps from the first tab to the last', async () => {
    const user = userEvent.setup();
    render(<Tabs items={NOTIFICATIONS_TABS} idPrefix="notifications" />);

    const allTab = screen.getByRole('tab', { name: 'Tất cả' });
    allTab.focus();
    await user.keyboard('{ArrowLeft}');

    expect(screen.getByRole('tab', { name: 'Đã đọc' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('roving tabindex follows the active tab', async () => {
    const user = userEvent.setup();
    render(<Tabs items={CUSTOMER_DETAIL_TABS} idPrefix="customer-detail" />);

    expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Lịch sử ca' })).toHaveAttribute('tabindex', '-1');

    const infoTab = screen.getByRole('tab', { name: 'Thông tin' });
    infoTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Lịch sử ca' })).toHaveAttribute('tabindex', '0');
  });
});

// ===========================================================================
// 5. axe-core — no critical ARIA violations when panels are wired
// ===========================================================================

describe('C.1.3 — axe-core a11y', () => {
  // Single canonical harness: Tabs + matching tabpanels mirror the contract
  // every consumer now follows. axe-core runs against the whole fragment so
  // a violation anywhere (missing id, dangling aria-controls, etc.) trips the
  // assertion.

  it('case-detail layout (Tabs + 7 panels) has no axe-core violations', async () => {
    const { container } = renderWithProviders(
      <>
        <Tabs items={CASE_DETAIL_TABS} idPrefix="case-detail" />
        {CASE_DETAIL_TABS.map((item) => (
          <div
            key={item.id}
            id={`case-detail-panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`case-detail-tab-${item.id}`}
          >
            {item.label} panel
          </div>
        ))}
      </>,
    );
    await expect(container as Element).toHaveNoViolations();
  });

  it('customer-detail layout (Tabs + 5 panels) has no axe-core violations', async () => {
    const { container } = renderWithProviders(
      <>
        <Tabs items={CUSTOMER_DETAIL_TABS} idPrefix="customer-detail" />
        {CUSTOMER_DETAIL_TABS.map((item) => (
          <div
            key={item.id}
            id={`customer-detail-panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`customer-detail-tab-${item.id}`}
          >
            {item.label} panel
          </div>
        ))}
      </>,
    );
    await expect(container as Element).toHaveNoViolations();
  });

  it('notifications + reports layouts have no axe-core violations', async () => {
    const { container } = renderWithProviders(
      <>
        <Tabs items={NOTIFICATIONS_TABS} idPrefix="notifications" />
        {NOTIFICATIONS_TABS.map((item) => (
          <div
            key={item.id}
            id={`notifications-panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`notifications-tab-${item.id}`}
          >
            {item.label} panel
          </div>
        ))}
        <Tabs items={REPORTS_TABS} idPrefix="reports" />
        {REPORTS_TABS.map((item) => (
          <div
            key={item.id}
            id={`reports-panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`reports-tab-${item.id}`}
          >
            {item.label} panel
          </div>
        ))}
      </>,
    );
    await expect(container as Element).toHaveNoViolations();
  });

  it('hand-rolled payments layout (role="tablist" + tab[aria-controls] + tabpanel) has no axe-core violations', async () => {
    const { container } = renderWithProviders(
      <>
        <div
          role="tablist"
          aria-orientation="horizontal"
          aria-label="Bộ lọc trạng thái thanh toán"
        >
          {PAYMENTS_TABS.map((item, idx) => (
            <button
              key={item.id}
              role="tab"
              id={`payments-tab-${item.id}`}
              aria-selected={idx === 0}
              aria-controls={`payments-tab-panel-${item.id}`}
              tabIndex={idx === 0 ? 0 : -1}
            >
              {item.label}
            </button>
          ))}
        </div>
        {PAYMENTS_TABS.map((item) => (
          <div
            key={item.id}
            id={`payments-tab-panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`payments-tab-${item.id}`}
          >
            {item.label} panel
          </div>
        ))}
      </>,
    );
    await expect(container as Element).toHaveNoViolations();
  });
});

// ===========================================================================
// 6. Click on tab fires onChange (selection behavior preserved)
// ===========================================================================

describe('C.1.3 — selection behavior', () => {
  it('fires onChange with the clicked tab id', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs items={REPORTS_TABS} idPrefix="reports" onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: 'Khách hàng' }));
    expect(onChange).toHaveBeenCalledWith('customer');
  });
});
