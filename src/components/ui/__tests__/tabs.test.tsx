import { describe, it, expect, vi } from 'vitest';
import { render, screen, renderWithProviders } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Tabs, TabItem } from '@/components/ui/tabs';

const ITEMS: TabItem[] = [
  { id: 'info', label: 'Thông tin' },
  { id: 'history', label: 'Lịch sử ca' },
  { id: 'timeline', label: 'Timeline' },
];

describe('Tabs (A.1)', () => {
  describe('ARIA roles', () => {
    it('renders role="tablist" with aria-orientation="horizontal"', () => {
      render(<Tabs items={ITEMS} />);
      const list = screen.getByRole('tablist');
      expect(list).toBeInTheDocument();
      expect(list).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('renders each tab with role="tab" and aria-selected reflecting active state', () => {
      render(<Tabs items={ITEMS} activeId="history" />);
      const infoTab = screen.getByRole('tab', { name: 'Thông tin' });
      const historyTab = screen.getByRole('tab', { name: 'Lịch sử ca' });
      const timelineTab = screen.getByRole('tab', { name: 'Timeline' });

      expect(infoTab).toHaveAttribute('aria-selected', 'false');
      expect(historyTab).toHaveAttribute('aria-selected', 'true');
      expect(timelineTab).toHaveAttribute('aria-selected', 'false');
    });

    it('exposes aria-controls pointing to a stable panel id', () => {
      render(<Tabs items={ITEMS} idPrefix="customer" />);
      const tab = screen.getByRole('tab', { name: 'Thông tin' });
      const controlsId = tab.getAttribute('aria-controls');
      expect(controlsId).toBe('customer-panel-info');
    });

    it('omits aria-controls when panelIds excludes the tab', () => {
      render(<Tabs items={ITEMS} panelIds={['info']} />);
      const infoTab = screen.getByRole('tab', { name: 'Thông tin' });
      const historyTab = screen.getByRole('tab', { name: 'Lịch sử ca' });
      expect(infoTab).toHaveAttribute('aria-controls');
      expect(historyTab).not.toHaveAttribute('aria-controls');
    });

    it('omits aria-controls entirely when panelIds is empty', () => {
      render(<Tabs items={ITEMS} panelIds={[]} />);
      ITEMS.forEach((item) => {
        const tab = screen.getByRole('tab', { name: item.label });
        expect(tab).not.toHaveAttribute('aria-controls');
      });
    });

    it('renders the same id on tab and lets consumers link panels via aria-labelledby', () => {
      render(
        <div>
          <Tabs items={ITEMS} idPrefix="customer" />
          <div
            role="tabpanel"
            id="customer-panel-info"
            aria-labelledby="customer-tab-info"
          >
            Panel for info
          </div>
        </div>,
      );
      const tab = screen.getByRole('tab', { name: 'Thông tin' });
      expect(tab.id).toBe('customer-tab-info');
      const panel = screen.getByRole('tabpanel');
      expect(panel).toHaveAttribute('aria-labelledby', 'customer-tab-info');
    });
  });

  describe('roving tabindex', () => {
    it('only the active tab is tabbable (tabIndex=0); others are -1', () => {
      render(<Tabs items={ITEMS} activeId="info" />);
      const infoTab = screen.getByRole('tab', { name: 'Thông tin' });
      const historyTab = screen.getByRole('tab', { name: 'Lịch sử ca' });
      const timelineTab = screen.getByRole('tab', { name: 'Timeline' });

      expect(infoTab).toHaveAttribute('tabindex', '0');
      expect(historyTab).toHaveAttribute('tabindex', '-1');
      expect(timelineTab).toHaveAttribute('tabindex', '-1');
    });

    it('updates roving tabindex when activeId changes', () => {
      function Harness() {
        const [active, setActive] = useState('info');
        return (
          <>
            <button data-testid="external" onClick={() => setActive('history')}>
              Switch
            </button>
            <Tabs items={ITEMS} activeId={active} onChange={setActive} />
          </>
        );
      }

      render(<Harness />);
      expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('tabindex', '0');
      expect(screen.getByRole('tab', { name: 'Lịch sử ca' })).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('keyboard navigation', () => {
    it('ArrowRight moves selection forward and focuses the next tab', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Tabs items={ITEMS} activeId="info" onChange={onChange} />);

      const infoTab = screen.getByRole('tab', { name: 'Thông tin' });
      infoTab.focus();
      await user.keyboard('{ArrowRight}');

      expect(onChange).toHaveBeenCalledWith('history');
      expect(screen.getByRole('tab', { name: 'Lịch sử ca' })).toHaveFocus();
    });

    it('ArrowLeft moves selection backward and focuses the previous tab', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Tabs items={ITEMS} activeId="history" onChange={onChange} />);

      const historyTab = screen.getByRole('tab', { name: 'Lịch sử ca' });
      historyTab.focus();
      await user.keyboard('{ArrowLeft}');

      expect(onChange).toHaveBeenCalledWith('info');
      expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveFocus();
    });

    it('ArrowRight wraps from the last tab to the first', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Tabs items={ITEMS} activeId="timeline" onChange={onChange} />);

      const lastTab = screen.getByRole('tab', { name: 'Timeline' });
      lastTab.focus();
      await user.keyboard('{ArrowRight}');

      expect(onChange).toHaveBeenCalledWith('info');
      expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveFocus();
    });

    it('ArrowLeft wraps from the first tab to the last', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Tabs items={ITEMS} activeId="info" onChange={onChange} />);

      const firstTab = screen.getByRole('tab', { name: 'Thông tin' });
      firstTab.focus();
      await user.keyboard('{ArrowLeft}');

      expect(onChange).toHaveBeenCalledWith('timeline');
      expect(screen.getByRole('tab', { name: 'Timeline' })).toHaveFocus();
    });

    it('Home jumps to the first tab', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Tabs items={ITEMS} activeId="timeline" onChange={onChange} />);

      const lastTab = screen.getByRole('tab', { name: 'Timeline' });
      lastTab.focus();
      await user.keyboard('{Home}');

      expect(onChange).toHaveBeenCalledWith('info');
      expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveFocus();
    });

    it('End jumps to the last tab', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Tabs items={ITEMS} activeId="info" onChange={onChange} />);

      const firstTab = screen.getByRole('tab', { name: 'Thông tin' });
      firstTab.focus();
      await user.keyboard('{End}');

      expect(onChange).toHaveBeenCalledWith('timeline');
      expect(screen.getByRole('tab', { name: 'Timeline' })).toHaveFocus();
    });

    it('ignores non-navigation keys (e.g. ArrowDown)', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Tabs items={ITEMS} activeId="info" onChange={onChange} />);

      const firstTab = screen.getByRole('tab', { name: 'Thông tin' });
      firstTab.focus();
      await user.keyboard('{ArrowDown}');

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('selection behavior', () => {
    it('calls onChange with the clicked tab id', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Tabs items={ITEMS} activeId="info" onChange={onChange} />);

      await user.click(screen.getByRole('tab', { name: 'Timeline' }));
      expect(onChange).toHaveBeenCalledWith('timeline');
    });

    it('falls back to internal state when no activeId is provided', () => {
      render(<Tabs items={ITEMS} />);
      expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('updates internal state when activeId is omitted and the user clicks', async () => {
      const user = userEvent.setup();
      render(<Tabs items={ITEMS} />);

      await user.click(screen.getByRole('tab', { name: 'Lịch sử ca' }));
      expect(screen.getByRole('tab', { name: 'Lịch sử ca' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveAttribute(
        'aria-selected',
        'false',
      );
    });
  });

  describe('visual variants', () => {
    it('renders underline variant with the same ARIA semantics', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <Tabs items={ITEMS} variant="underline" activeId="info" onChange={onChange} />,
      );
      expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal');
      expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('tabindex', '0');

      const infoTab = screen.getByRole('tab', { name: 'Thông tin' });
      infoTab.focus();
      await user.keyboard('{ArrowRight}');

      expect(onChange).toHaveBeenCalledWith('history');
    });
  });

  describe('a11y', () => {
    it('has no axe-core violations on the default render', async () => {
      const { container } = renderWithProviders(<Tabs items={ITEMS} panelIds={[]} />);
      const firstTab = container.querySelector('[role="tab"]');
      await expect(firstTab as Element).toHaveNoViolations();
    });

    it('has no axe-core violations with panels wired via aria-labelledby', async () => {
      const { container } = renderWithProviders(
        <div>
          <Tabs items={ITEMS} idPrefix="cust" />
          <div role="tabpanel" id="cust-panel-info" aria-labelledby="cust-tab-info">
            Info panel
          </div>
          <div role="tabpanel" id="cust-panel-history" aria-labelledby="cust-tab-history" hidden>
            History panel
          </div>
          <div role="tabpanel" id="cust-panel-timeline" aria-labelledby="cust-tab-timeline" hidden>
            Timeline panel
          </div>
        </div>,
      );
      const tablist = container.querySelector('[role="tablist"]');
      await expect(tablist as Element).toHaveNoViolations();
    });
  });
});