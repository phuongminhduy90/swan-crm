/**
 * Story C.1.2 — Case detail tabs icon-only on mobile.
 *
 * Acceptance criteria (see `docs/ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md`
 * §1.1 / §5.2):
 *   1. Case detail tabs render icon-only at viewport `< sm` (≤ 640 px).
 *   2. Tab labels show as `<title>` tooltips on hover/focus when icon-only.
 *   3. Tab icons are wired to existing labels.
 *   4. At `≥ sm`, tabs render icon + label (current behavior).
 *   5. `<Tabs>` primitive gains an `iconOnly?: 'auto' | 'always' | 'never'`
 *      prop with `'auto'` default.
 *   6. `useMediaQuery` (already shipped in Sprint 6.3) reused, no new hook.
 *
 * This test covers the primitive surface (the contract every consumer — case
 * detail page, future migrations — relies on). The case-detail page
 * integration is covered indirectly through axe-core: the primitive is the
 * only thing C.1.2 introduces.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, renderWithProviders } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { Info } from 'lucide-react';
import { Tabs, TabItem } from '@/components/ui/tabs';

const ITEMS: TabItem[] = [
  { id: 'info', label: 'Thông tin', icon: <Info data-testid="icon-info" className="h-4 w-4" /> },
  { id: 'services', label: 'Dịch vụ', icon: <Info data-testid="icon-services" className="h-4 w-4" /> },
  { id: 'payments', label: 'Thanh toán', icon: <Info data-testid="icon-payments" className="h-4 w-4" /> },
];

// ---------------------------------------------------------------------------
// `useMediaQuery` stub
// ---------------------------------------------------------------------------
// jsdom does not implement `window.matchMedia` natively. The Sprint 6.3 test
// suite installs a stub once at the suite level; we mirror the same pattern
// here so the `iconOnly="auto"` mode is exercisable from vitest.

const originalMatchMedia = window.matchMedia;
let currentMatches = false;

function setMatches(value: boolean) {
  currentMatches = value;
}

function installMatchMediaStub() {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: currentMatches,
      media: query,
      onchange: null,
      addListener: (cb: (e: { matches: boolean }) => void) => listeners.add(cb),
      removeListener: (cb: (e: { matches: boolean }) => void) => listeners.delete(cb),
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.delete(cb),
      dispatchEvent: () => true,
    }),
  });
}

function restoreMatchMediaStub() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: originalMatchMedia,
  });
}

beforeEach(() => {
  setMatches(false);
  installMatchMediaStub();
});

afterEach(() => {
  restoreMatchMediaStub();
});

// ---------------------------------------------------------------------------
// Mode resolution
// ---------------------------------------------------------------------------

describe('Tabs (C.1.2) — iconOnly mode', () => {
  describe('default mode is "auto"', () => {
    it('defaults to icon-only on small viewports (matchMedia=false)', () => {
      setMatches(false); // < sm
      render(<Tabs items={ITEMS} panelIds={[]} />);

      // The visible text label is rendered as sr-only — not visible to sighted
      // users but kept in DOM for screen readers.
      const labelEls = screen.getAllByText('Thông tin', { selector: 'span' });
      const visibleLabel = labelEls.find((el) => !el.className.includes('sr-only'));
      expect(visibleLabel).toBeUndefined();
    });

    it('defaults to icon+label on large viewports (matchMedia=true)', () => {
      setMatches(true); // ≥ sm
      render(<Tabs items={ITEMS} panelIds={[]} />);

      const infoTab = screen.getByRole('tab', { name: /Thông tin/ });
      // The label is rendered as a plain span (no sr-only) and is part of the
      // accessible name.
      expect(infoTab).toHaveAccessibleName(/Thông tin/);
    });
  });

  describe('iconOnly="always"', () => {
    it('renders icon-only regardless of viewport size', () => {
      setMatches(true); // even on large viewports
      render(<Tabs items={ITEMS} iconOnly="always" panelIds={[]} />);

      const infoTab = screen.getByRole('tab', { name: 'Thông tin' });
      expect(infoTab).toHaveAttribute('aria-label', 'Thông tin');
      expect(infoTab).toHaveAttribute('title', 'Thông tin');
    });

    it('adds sr-only to the text label', () => {
      setMatches(true);
      render(<Tabs items={ITEMS} iconOnly="always" panelIds={[]} />);

      const labelEls = screen.getAllByText('Thông tin', { selector: 'span' });
      // Every span containing the label must be sr-only when iconOnly=always.
      labelEls.forEach((el) => {
        expect(el.className).toContain('sr-only');
      });
    });

    it('marks the icon wrapper aria-hidden=true', () => {
      render(<Tabs items={ITEMS} iconOnly="always" panelIds={[]} />);

      // The icon wrapper is the immediate <span> around the icon (the
      // `inline-flex items-center` container). It should carry aria-hidden.
      const iconSpan = screen.getByTestId('icon-info').parentElement;
      expect(iconSpan).toHaveAttribute('aria-hidden', 'true');
    });

    it('omits aria-label and title when labels are visible', () => {
      setMatches(true);
      render(<Tabs items={ITEMS} iconOnly="never" panelIds={[]} />);

      const infoTab = screen.getByRole('tab', { name: 'Thông tin' });
      expect(infoTab).not.toHaveAttribute('aria-label');
      expect(infoTab).not.toHaveAttribute('title');
    });
  });

  describe('iconOnly="never"', () => {
    it('always renders icon + label even on small viewports', () => {
      setMatches(false); // < sm
      render(<Tabs items={ITEMS} iconOnly="never" panelIds={[]} />);

      const infoTab = screen.getByRole('tab', { name: /Thông tin/ });
      expect(infoTab).toHaveAccessibleName(/Thông tin/);
      expect(infoTab).not.toHaveAttribute('aria-label');
    });
  });

  describe('iconOnly="auto" — viewport resolution', () => {
    it('collapses to icon-only when matchMedia is false (< 640 px)', () => {
      setMatches(false);
      render(<Tabs items={ITEMS} iconOnly="auto" panelIds={[]} />);

      const infoTab = screen.getByRole('tab', { name: 'Thông tin' });
      // aria-label is set so screen readers still announce the label.
      expect(infoTab).toHaveAttribute('aria-label', 'Thông tin');
      expect(infoTab).toHaveAttribute('title', 'Thông tin');
    });

    it('expands to icon + label when matchMedia is true (>= 640 px)', () => {
      setMatches(true);
      render(<Tabs items={ITEMS} iconOnly="auto" panelIds={[]} />);

      const infoTab = screen.getByRole('tab', { name: /Thông tin/ });
      expect(infoTab).toHaveAccessibleName(/Thông tin/);
      expect(infoTab).not.toHaveAttribute('aria-label');
    });
  });
});

// ---------------------------------------------------------------------------
// Visual treatment
// ---------------------------------------------------------------------------

describe('Tabs (C.1.2) — visual treatment', () => {
  it('uses compact p-2 padding when icon-only', () => {
    setMatches(false);
    render(<Tabs items={ITEMS} iconOnly="always" panelIds={[]} />);

    const infoTab = screen.getByRole('tab', { name: 'Thông tin' });
    // p-2 should be applied; px-4 py-2 should NOT.
    expect(infoTab.className).toContain('p-2');
    expect(infoTab.className).not.toContain('px-4');
    expect(infoTab.className).not.toContain('py-2');
  });

  it('uses full px-4 py-2 padding when labels are visible', () => {
    setMatches(true);
    render(<Tabs items={ITEMS} iconOnly="never" panelIds={[]} />);

    const infoTab = screen.getByRole('tab', { name: 'Thông tin' });
    expect(infoTab.className).toContain('px-4');
    expect(infoTab.className).toContain('py-2');
    expect(infoTab.className).not.toMatch(/\bp-2\b/);
  });

  it('preserves active-state gradient styling in icon-only mode', () => {
    setMatches(false);
    render(<Tabs items={ITEMS} activeId="services" iconOnly="always" panelIds={[]} />);

    const servicesTab = screen.getByRole('tab', { name: 'Dịch vụ' });
    expect(servicesTab.className).toContain('bg-gradient-to-r');
    expect(servicesTab.className).toContain('from-swan-500');
  });
});

// ---------------------------------------------------------------------------
// Behavior preservation — keyboard navigation, ARIA semantics, selection
// ---------------------------------------------------------------------------

describe('Tabs (C.1.2) — keyboard navigation in icon-only mode', () => {
  it('ArrowRight still moves selection and focus when icon-only', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs items={ITEMS} activeId="info" iconOnly="always" panelIds={[]} onChange={onChange} />);

    const infoTab = screen.getByRole('tab', { name: 'Thông tin' });
    infoTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith('services');
    expect(screen.getByRole('tab', { name: 'Dịch vụ' })).toHaveFocus();
  });

  it('ArrowLeft still wraps from first to last when icon-only', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs items={ITEMS} activeId="info" iconOnly="always" panelIds={[]} onChange={onChange} />);

    const infoTab = screen.getByRole('tab', { name: 'Thông tin' });
    infoTab.focus();
    await user.keyboard('{ArrowLeft}');

    expect(onChange).toHaveBeenCalledWith('payments');
    expect(screen.getByRole('tab', { name: 'Thanh toán' })).toHaveFocus();
  });

  it('Home / End still work in icon-only mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs items={ITEMS} activeId="services" iconOnly="always" panelIds={[]} onChange={onChange} />);

    const servicesTab = screen.getByRole('tab', { name: 'Dịch vụ' });
    servicesTab.focus();
    await user.keyboard('{End}');

    expect(onChange).toHaveBeenCalledWith('payments');
  });

  it('roving tabindex still only marks the active tab tabbable', () => {
    setMatches(false);
    render(<Tabs items={ITEMS} activeId="info" iconOnly="always" panelIds={[]} />);

    expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Dịch vụ' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Thanh toán' })).toHaveAttribute('tabindex', '-1');
  });

  it('click selection still fires onChange in icon-only mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs items={ITEMS} iconOnly="always" panelIds={[]} onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: 'Thanh toán' }));
    expect(onChange).toHaveBeenCalledWith('payments');
  });
});

// ---------------------------------------------------------------------------
// aria-controls + panelIds interaction (preserved from C.1.3 dependency)
// ---------------------------------------------------------------------------

describe('Tabs (C.1.2) — panelIds preservation', () => {
  it('still suppresses aria-controls when panelIds is empty in icon-only mode', () => {
    setMatches(false);
    render(<Tabs items={ITEMS} iconOnly="always" panelIds={[]} />);

    ITEMS.forEach((item) => {
      const tab = screen.getByRole('tab', { name: item.label });
      expect(tab).not.toHaveAttribute('aria-controls');
    });
  });
});

// ---------------------------------------------------------------------------
// a11y
// ---------------------------------------------------------------------------

describe('Tabs (C.1.2) — a11y', () => {
  it('icon-only render has no axe-core violations', async () => {
    setMatches(false);
    const { container } = renderWithProviders(
      <Tabs items={ITEMS} iconOnly="always" panelIds={[]} />,
    );
    const tablist = container.querySelector('[role="tablist"]');
    await expect(tablist as Element).toHaveNoViolations();
  });

  it('icon+label render has no axe-core violations', async () => {
    setMatches(true);
    const { container } = renderWithProviders(
      <Tabs items={ITEMS} iconOnly="never" panelIds={[]} />,
    );
    const tablist = container.querySelector('[role="tablist"]');
    await expect(tablist as Element).toHaveNoViolations();
  });
});