/**
 * Story S1 / B.3.2 — `<Tooltip>` primitive tests.
 *
 * Covers the new lightweight Tooltip primitive in `src/components/ui/tooltip.tsx`.
 * Verifies hover + keyboard show/hide, Escape dismiss, click-outside dismiss,
 * `aria-describedby` linkage, and the `role="tooltip"` bubble contract.
 *
 * Note: this project uses Vitest's `expect.extend` only via the local
 * `toHaveNoViolations` matcher; standard jest-dom matchers (e.g.
 * `toBeHidden`) are not registered globally. We check the `hidden`
 * attribute directly instead.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '@/components/ui/tooltip';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

/** Flush the tooltip's show-delay timer. */
async function flushShowDelay() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(150);
  });
}

function isBubbleHidden(bubble: HTMLElement): boolean {
  return bubble.hasAttribute('hidden');
}

describe('Tooltip (B.3.2)', () => {
  describe('rendering', () => {
    it('renders the bubble in the DOM but hidden by default', () => {
      render(
        <Tooltip content="Tooltip text">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const bubble = screen.getByRole('tooltip', { hidden: true });
      expect(bubble).toBeInTheDocument();
      expect(bubble).toHaveTextContent('Tooltip text');
      expect(isBubbleHidden(bubble)).toBe(true);
    });

    it('renders the trigger element with an accessible name', () => {
      render(
        <Tooltip content="Hello">
          <button type="button">Hover me</button>
        </Tooltip>,
      );
      expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument();
    });

    it('uses a consumer-provided id and applies it to the bubble', () => {
      render(
        <Tooltip id="my-tooltip" content="X">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const bubble = document.getElementById('my-tooltip');
      expect(bubble).not.toBeNull();
      expect(bubble).toHaveAttribute('role', 'tooltip');
    });

    it('auto-generates a unique id when none is provided', () => {
      render(
        <Tooltip content="auto">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const bubble = screen.getByRole('tooltip', { hidden: true });
      expect(bubble.id).toMatch(/^tooltip-:/);
    });
  });

  describe('hover show/hide', () => {
    it('shows the bubble on mouseenter after the delay', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      render(
        <Tooltip content="Hover copy">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const bubble = screen.getByRole('tooltip', { hidden: true });

      await user.hover(trigger);
      await flushShowDelay();
      expect(isBubbleHidden(bubble)).toBe(false);
    });

    it('hides the bubble on mouseleave', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      render(
        <Tooltip content="Hover copy">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const bubble = screen.getByRole('tooltip', { hidden: true });

      await user.hover(trigger);
      await flushShowDelay();
      expect(isBubbleHidden(bubble)).toBe(false);

      await user.unhover(trigger);
      expect(isBubbleHidden(bubble)).toBe(true);
    });
  });

  describe('keyboard focus show/hide', () => {
    it('shows the bubble on focus', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      render(
        <Tooltip content="Focus copy">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const bubble = screen.getByRole('tooltip', { hidden: true });

      trigger.focus();
      await flushShowDelay();
      expect(isBubbleHidden(bubble)).toBe(false);
    });

    it('hides the bubble when focus moves elsewhere', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      render(
        <div>
          <Tooltip content="Focus copy">
            <button type="button">Trigger</button>
          </Tooltip>
          <button type="button" data-testid="next">Next</button>
        </div>,
      );
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const bubble = screen.getByRole('tooltip', { hidden: true });

      trigger.focus();
      await flushShowDelay();
      expect(isBubbleHidden(bubble)).toBe(false);

      await user.tab();
      expect(isBubbleHidden(bubble)).toBe(true);
    });

    it('wires aria-describedby to the bubble id while open', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      render(
        <Tooltip id="kb-tip" content="KB">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      trigger.focus();
      await flushShowDelay();

      expect(trigger).toHaveAttribute('aria-describedby', 'kb-tip');
    });

    it('removes aria-describedby when closed', () => {
      render(
        <Tooltip id="kb-tip2" content="KB">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(trigger).not.toHaveAttribute('aria-describedby');
    });
  });

  describe('Escape dismiss', () => {
    it('pressing Escape closes an open tooltip', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      render(
        <Tooltip content="Press Esc">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const bubble = screen.getByRole('tooltip', { hidden: true });

      trigger.focus();
      await flushShowDelay();
      expect(isBubbleHidden(bubble)).toBe(false);

      await user.keyboard('{Escape}');
      expect(isBubbleHidden(bubble)).toBe(true);
    });
  });

  describe('click-outside dismiss', () => {
    it('clicking outside the trigger and bubble hides the tooltip', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      render(
        <div>
          <Tooltip content="Outside test">
            <button type="button">Trigger</button>
          </Tooltip>
          <button type="button" data-testid="outside">Outside</button>
        </div>,
      );
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const bubble = screen.getByRole('tooltip', { hidden: true });

      trigger.focus();
      await flushShowDelay();
      expect(isBubbleHidden(bubble)).toBe(false);

      await user.click(screen.getByTestId('outside'));
      expect(isBubbleHidden(bubble)).toBe(true);
    });
  });

  describe('placement / align', () => {
    it('applies bottom placement classes when placement="bottom"', () => {
      render(
        <Tooltip content="Below" placement="bottom">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const bubble = screen.getByRole('tooltip', { hidden: true });
      expect(bubble.className).toMatch(/top-full/);
      expect(bubble.className).not.toMatch(/bottom-full/);
    });

    it('applies top placement classes by default', () => {
      render(
        <Tooltip content="Above">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const bubble = screen.getByRole('tooltip', { hidden: true });
      expect(bubble.className).toMatch(/bottom-full/);
      expect(bubble.className).toMatch(/mb-2/);
    });

    it('applies align="end" (right) classes when requested', () => {
      render(
        <Tooltip content="End" align="end">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const bubble = screen.getByRole('tooltip', { hidden: true });
      expect(bubble.className).toMatch(/right-0/);
    });

    it('applies align="center" by default', () => {
      render(
        <Tooltip content="Center">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const bubble = screen.getByRole('tooltip', { hidden: true });
      expect(bubble.className).toMatch(/-translate-x-1\/2/);
    });
  });

  describe('a11y', () => {
    it('the bubble is announced as a tooltip via role="tooltip"', () => {
      render(
        <Tooltip content="Screen reader copy">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const bubble = screen.getByRole('tooltip', { hidden: true });
      expect(bubble).toHaveAttribute('role', 'tooltip');
    });

    it('uses a high-contrast bubble background (bg-gray-900 / text-white)', () => {
      render(
        <Tooltip content="Contrast">
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      const bubble = screen.getByRole('tooltip', { hidden: true });
      expect(bubble.className).toMatch(/bg-gray-900/);
      expect(bubble.className).toMatch(/text-white/);
    });
  });
});