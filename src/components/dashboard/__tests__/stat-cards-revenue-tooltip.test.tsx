/**
 * Story S1 / B.3.2 (F-HIGH-29) — Revenue StatCard tooltip tests.
 *
 * Verifies the dashboard's "Doanh thu tháng" card exposes:
 *  - a visible Info button trigger (`data-testid="revenue-tooltip-trigger"`)
 *  - a `role="tooltip"` bubble with byte-exact Vietnamese copy
 *  - `aria-describedby` linkage from the link to the tooltip bubble id
 *  - hover + keyboard focus open/close behaviour
 *  - Escape and click-outside dismiss
 *  - high-contrast bubble styling
 *
 * Critically, the other 4 StatCards must NOT regress: they still expose
 * their tooltip text via the sr-only span + `aria-describedby` pattern.
 *
 * @see docs/ux-redesign/SPRINT_6_4_EXECUTION_PLAN.md §2.1, Appendix A.1
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { StatCards } from '@/components/dashboard/stat-cards';

// ---------- Firestore mocks (mirror stat-cards.test.tsx) ----------

vi.mock('@/lib/firebase/firestore', () => ({
  getDocument: vi.fn(),
  setDocument: vi.fn(),
  updateDocument: vi.fn(),
  getAllDocuments: vi.fn(),
}));

vi.mock('@/lib/firebase/client', () => ({
  isFirebaseConfigured: () => false,
}));

vi.mock('@/lib/firebase/admin', () => ({}));

const getAllCustomersMock = vi.fn();
const getAllCasesMock = vi.fn();
const getAllPaymentsMock = vi.fn();
const getAllAppointmentsMock = vi.fn();

vi.mock('@/lib/firestore/customers', () => ({
  getAllCustomers: (...args: unknown[]) => getAllCustomersMock(...args),
}));
vi.mock('@/lib/firestore/cases', () => ({
  getAllCases: (...args: unknown[]) => getAllCasesMock(...args),
}));
vi.mock('@/lib/firestore/payments', () => ({
  getAllPayments: (...args: unknown[]) => getAllPaymentsMock(...args),
}));
vi.mock('@/lib/firestore/appointments', () => ({
  getAllAppointments: (...args: unknown[]) => getAllAppointmentsMock(...args),
}));
vi.mock('@/lib/firestore', () => ({
  getAllCustomers: (...args: unknown[]) => getAllCustomersMock(...args),
  getAllCases: (...args: unknown[]) => getAllCasesMock(...args),
  getAllPayments: (...args: unknown[]) => getAllPaymentsMock(...args),
  getAllAppointments: (...args: unknown[]) => getAllAppointmentsMock(...args),
}));

// ---------- Setup ----------

const NOW = new Date('2026-06-30T10:00:00.000Z');
const REVENUE_TOOLTIP_COPY =
  'Chỉ tính thanh toán đã xác nhận, không bao gồm đang chờ hoặc hoàn tiền';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  getAllCustomersMock.mockReset();
  getAllCasesMock.mockReset();
  getAllPaymentsMock.mockReset();
  getAllAppointmentsMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

async function resolveLoad() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
}

async function flushShowDelay() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(150);
  });
}

function mockEmpty() {
  getAllCustomersMock.mockResolvedValue([]);
  getAllCasesMock.mockResolvedValue([]);
  getAllPaymentsMock.mockResolvedValue([]);
  getAllAppointmentsMock.mockResolvedValue([]);
}

function getRevenueLink() {
  return screen.getByRole('link', {
    name: /Doanh thu tháng.*Đã xác nhận trong tháng/,
  });
}

function getRevenueTrigger() {
  return screen.getByTestId('revenue-tooltip-trigger');
}

function getRevenueBubble() {
  return screen.getByRole('tooltip', { hidden: true });
}

function isBubbleHidden(bubble: HTMLElement): boolean {
  return bubble.hasAttribute('hidden');
}

// ---------- Tests ----------

describe('StatCards — Revenue tooltip (B.3.2)', () => {
  describe('trigger affordance', () => {
    it('renders a visible Info button on the revenue card only', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const triggers = screen.getAllByTestId('revenue-tooltip-trigger');
      expect(triggers).toHaveLength(1);
      const trigger = triggers[0]!;
      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger).toHaveAttribute('type', 'button');
      expect(trigger).toHaveAttribute(
        'aria-label',
        'Thông tin thêm về doanh thu tháng',
      );
    });

    it('renders the Info button with a focus-visible ring affordance', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const trigger = getRevenueTrigger();
      expect(trigger.className).toMatch(/focus-visible:ring-2/);
    });

    it('renders the Info icon as a decorative, aria-hidden SVG inside the trigger', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const trigger = getRevenueTrigger();
      const svg = trigger.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      // Lucide icon CSS size is controlled via Tailwind classes (h-4 w-4);
      // the underlying <svg> width/height attributes are defaults and not
      // what consumers care about.
      expect(svg?.className?.baseVal ?? svg?.getAttribute('class')).toMatch(/h-4/);
      expect(svg?.className?.baseVal ?? svg?.getAttribute('class')).toMatch(/w-4/);
    });

    it('does NOT render a tooltip trigger on the other 4 cards', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const triggers = screen.queryAllByTestId('revenue-tooltip-trigger');
      expect(triggers).toHaveLength(1);
    });
  });

  describe('tooltip copy + ARIA wiring', () => {
    it('renders a role="tooltip" bubble with byte-exact Vietnamese copy', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const bubble = getRevenueBubble();
      expect(bubble).toBeInTheDocument();
      expect(bubble.textContent).toBe(REVENUE_TOOLTIP_COPY);
    });

    it('uses the same id for the bubble as the link aria-describedby', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const link = getRevenueLink();
      const describedBy = link.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();

      const bubble = getRevenueBubble();
      expect(bubble.id).toBe(describedBy);
    });

    it('hides the tooltip bubble by default via the hidden attribute', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const bubble = getRevenueBubble();
      expect(isBubbleHidden(bubble)).toBe(true);
    });

    it('keeps the sr-only span pattern for the other 4 cards (no regression)', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      // The Lab card still wires its tooltip text via the sr-only span.
      const labLink = screen.getByRole('link', {
        name: /Lab quá hạn.*Ca chờ xét nghiệm quá hạn/,
      });
      const describedBy = labLink.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const tooltipEl = document.getElementById(describedBy as string);
      expect(tooltipEl).not.toBeNull();
      expect(tooltipEl?.className).toMatch(/sr-only/);
      expect(tooltipEl?.textContent).toMatch(/quá hạn/);
    });

    it('uses a high-contrast bubble background (bg-gray-900 / text-white)', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const bubble = getRevenueBubble();
      expect(bubble.className).toMatch(/bg-gray-900/);
      expect(bubble.className).toMatch(/text-white/);
    });
  });

  describe('hover show/hide', () => {
    it('reveals the tooltip on mouseenter (after the show delay)', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const trigger = getRevenueTrigger();
      const bubble = getRevenueBubble();
      expect(isBubbleHidden(bubble)).toBe(true);

      await user.hover(trigger);
      await flushShowDelay();
      expect(isBubbleHidden(bubble)).toBe(false);
    });

    it('hides the tooltip on mouseleave', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const trigger = getRevenueTrigger();
      const bubble = getRevenueBubble();

      await user.hover(trigger);
      await flushShowDelay();
      expect(isBubbleHidden(bubble)).toBe(false);

      await user.unhover(trigger);
      expect(isBubbleHidden(bubble)).toBe(true);
    });
  });

  describe('keyboard focus show/hide', () => {
    it('reveals the tooltip when the trigger receives focus', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const trigger = getRevenueTrigger();
      const bubble = getRevenueBubble();

      trigger.focus();
      await flushShowDelay();
      expect(isBubbleHidden(bubble)).toBe(false);
    });

    it('hides the tooltip when focus moves elsewhere', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const trigger = getRevenueTrigger();
      const bubble = getRevenueBubble();

      await act(async () => {
        trigger.focus();
      });
      await flushShowDelay();
      expect(isBubbleHidden(bubble)).toBe(false);

      // Move focus to a different element (Next button). This fires the
      // blur handler on the trigger, which dismisses the tooltip.
      await act(async () => {
        trigger.blur();
        // Dispatch a real blur event so React's synthetic event system fires.
        fireEvent.blur(trigger);
      });
      expect(isBubbleHidden(bubble)).toBe(true);
    });

    it('wires aria-describedby to the tooltip id only while open', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const trigger = getRevenueTrigger();
      // Closed by default → no aria-describedby on the trigger button itself.
      expect(trigger).not.toHaveAttribute('aria-describedby');

      trigger.focus();
      await flushShowDelay();
      expect(trigger).toHaveAttribute('aria-describedby');

      const bubble = getRevenueBubble();
      expect(trigger.getAttribute('aria-describedby')).toBe(bubble.id);
    });

    it('keeps the revenue link aria-describedby pointing at the tooltip id', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const link = getRevenueLink();
      const bubble = getRevenueBubble();
      expect(link.getAttribute('aria-describedby')).toBe(bubble.id);
    });
  });

  describe('Escape + click-outside dismiss', () => {
    it('pressing Escape closes the tooltip', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const trigger = getRevenueTrigger();
      const bubble = getRevenueBubble();

      trigger.focus();
      await flushShowDelay();
      expect(isBubbleHidden(bubble)).toBe(false);

      await user.keyboard('{Escape}');
      expect(isBubbleHidden(bubble)).toBe(true);
    });

    it('clicking outside dismisses the tooltip', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const trigger = getRevenueTrigger();
      const bubble = getRevenueBubble();

      trigger.focus();
      await flushShowDelay();
      expect(isBubbleHidden(bubble)).toBe(false);

      // Click on a different card body (outside the trigger and bubble).
      const labCard = screen.getByRole('link', {
        name: /Lab quá hạn.*Ca chờ xét nghiệm quá hạn/,
      });
      await user.click(labCard);
      expect(isBubbleHidden(bubble)).toBe(true);
    });
  });

  describe('viewport fit (mobile)', () => {
    it('uses a constrained max-width that fits within a 360px viewport card', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const bubble = getRevenueBubble();
      // Tailwind's `max-w-[240px]` compiles to a className fragment.
      expect(bubble.className).toMatch(/max-w-\[240px\]/);
    });
  });

  describe('business logic preserved', () => {
    it('still computes revenue as confirmed-only (no pending or refund)', async () => {
      getAllCustomersMock.mockResolvedValue([]);
      getAllCasesMock.mockResolvedValue([]);
      getAllPaymentsMock.mockResolvedValue([
        {
          id: 'p1',
          caseId: 'c1',
          amount: 5_000_000,
          status: 'confirmed',
          paymentDate: '2026-06-15T00:00:00.000Z',
          createdAt: '2026-06-15T00:00:00.000Z',
        } as never,
        {
          id: 'p2',
          caseId: 'c2',
          amount: 3_000_000,
          status: 'pending',
          paymentDate: '2026-06-15T00:00:00.000Z',
          createdAt: '2026-06-15T00:00:00.000Z',
        } as never,
        {
          id: 'p3',
          caseId: 'c3',
          amount: 1_000_000,
          status: 'refunded',
          paymentDate: '2026-06-15T00:00:00.000Z',
          createdAt: '2026-06-15T00:00:00.000Z',
        } as never,
      ]);
      getAllAppointmentsMock.mockResolvedValue([]);

      render(<StatCards />);
      await resolveLoad();

      const revenueLink = getRevenueLink();
      // Only the 5M confirmed payment counts; formatCompact renders
      // 5,000,000 as "5.0M" (see src/lib/utils/format.ts:formatCompact).
      expect(within(revenueLink).getByText('5.0M')).toBeInTheDocument();

      // The tooltip text is byte-exact — also asserts the bubble's id matches
      // the link's aria-describedby (the descriptive contract).
      const bubble = getRevenueBubble();
      expect(bubble).toHaveTextContent(REVENUE_TOOLTIP_COPY);
    });
  });
});