/**
 * Story C.2.3 — Reports date filter URL-sync + refetch + active-pill X icon.
 *
 * Verifies the new behavior of `<ReportFilters>`:
 *  1. Pill bar: 4 options (3/6/12 tháng + Tất cả), only one is "active"
 *  2. Active pill shows a checkmark + X icon when `onClear` is provided
 *  3. Clicking a non-active option fires `onChange` with the new value
 *  4. Clicking the X icon on the active pill fires `onClear` (and does NOT
 *     fire `onChange` — the click must be `stopPropagation`'d)
 *  5. "Đang lọc: …" banner pill is rendered when `activeFilterLabel` is set
 *  6. "Xóa tất cả bộ lọc" button is rendered when both `activeFilterLabel`
 *     and `onClear` are set; clicking it fires `onClear`
 *  7. When `onClear` is omitted, no X icon is rendered (back-compat)
 *  8. When `activeFilterLabel` is null/undefined, no banner is shown
 *
 * @see docs/ux-redesign/SPRINT_7_2_EXECUTION_PLAN.md §1.1 (C.2.3 row)
 * @see docs/ux-redesign/STORY_C2_3_MIGRATION_NOTES.md
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportFilters, DATE_RANGE_OPTIONS } from '@/components/reports/report-filters';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ReportFilters (C.2.3 — URL-sync + active pill + clear X)', () => {
  it('renders all 4 date-range options as pills', () => {
    const onChange = vi.fn();
    render(<ReportFilters value={6} onChange={onChange} />);
    DATE_RANGE_OPTIONS.forEach((opt) => {
      expect(screen.getByTestId(`report-filter-${opt.value}`)).toBeInTheDocument();
      expect(screen.getByText(opt.label)).toBeInTheDocument();
    });
  });

  it('fires onChange with the new value when a non-active pill is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ReportFilters value={6} onChange={onChange} />);

    await user.click(screen.getByTestId('report-filter-3'));
    expect(onChange).toHaveBeenCalledWith(3);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('shows a checkmark on the active pill', () => {
    render(<ReportFilters value={3} onChange={vi.fn()} />);
    const active = screen.getByTestId('report-filter-3');
    // The Check icon is rendered with `aria-hidden="true"` — the visible
    // character we can assert is that the button contains the text "3 tháng"
    // AND has a <svg> element (the check + label render inside it).
    expect(active.textContent).toMatch(/3 tháng/);
    expect(active.querySelector('svg')).not.toBeNull();
  });

  it('does not render X icon when onClear is omitted (back-compat)', () => {
    render(<ReportFilters value={3} onChange={vi.fn()} />);
    expect(screen.queryByTestId('report-filter-clear-3')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Xóa bộ lọc 3 tháng/),
    ).not.toBeInTheDocument();
  });

  it('renders X icon on the active pill when onClear is provided', () => {
    render(<ReportFilters value={6} onChange={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByTestId('report-filter-clear-6')).toBeInTheDocument();
    expect(screen.getByLabelText('Xóa bộ lọc 6 tháng')).toBeInTheDocument();
  });

  it('clicking the X icon fires onClear, NOT onChange', async () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(<ReportFilters value={6} onChange={onChange} onClear={onClear} />);

    await user.click(screen.getByTestId('report-filter-clear-6'));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders the "Đang lọc: …" banner when activeFilterLabel is set', () => {
    render(
      <ReportFilters
        value={3}
        onChange={vi.fn()}
        onClear={vi.fn()}
        activeFilterLabel="Đang lọc: 3 tháng"
      />,
    );
    expect(screen.getByText('Đang lọc: 3 tháng')).toBeInTheDocument();
    expect(screen.getByTestId('report-filter-clear-all')).toBeInTheDocument();
    expect(screen.getByTestId('report-filter-xoa-tat-ca')).toBeInTheDocument();
  });

  it('does not render the banner when activeFilterLabel is null', () => {
    render(
      <ReportFilters
        value={6}
        onChange={vi.fn()}
        onClear={vi.fn()}
        activeFilterLabel={null}
      />,
    );
    expect(screen.queryByTestId('report-filter-clear-all')).not.toBeInTheDocument();
    expect(screen.queryByTestId('report-filter-xoa-tat-ca')).not.toBeInTheDocument();
  });

  it('does not render the banner when activeFilterLabel is undefined', () => {
    render(
      <ReportFilters value={6} onChange={vi.fn()} onClear={vi.fn()} />,
    );
    expect(screen.queryByTestId('report-filter-clear-all')).not.toBeInTheDocument();
  });

  it('clicking "Xóa tất cả bộ lọc" fires onClear', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(
      <ReportFilters
        value={12}
        onChange={vi.fn()}
        onClear={onClear}
        activeFilterLabel="Đang lọc: 12 tháng"
      />,
    );
    await user.click(screen.getByTestId('report-filter-xoa-tat-ca'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('clicking the banner X also fires onClear', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(
      <ReportFilters
        value={12}
        onChange={vi.fn()}
        onClear={onClear}
        activeFilterLabel="Đang lọc: 12 tháng"
      />,
    );
    await user.click(screen.getByTestId('report-filter-clear-all'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('X icon on the active pill has aria-label matching the option label', () => {
    render(
      <ReportFilters
        value={12}
        onChange={vi.fn()}
        onClear={vi.fn()}
        activeFilterLabel="Đang lọc: 12 tháng"
      />,
    );
    expect(
      screen.getByLabelText('Xóa bộ lọc 12 tháng'),
    ).toBeInTheDocument();
  });
});
