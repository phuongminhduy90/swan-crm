/**
 * Story TD-2 (Sprint 7.1) — Toast API extension.
 *
 * Verifies the new Toast provider in `src/components/ui/toast.tsx`:
 *
 *  1. Backward compat — `toast('msg')` and `toast('msg', 'error')` keep
 *     rendering exactly the same as before (used by 20+ existing call
 *     sites — see topbar, customers list/detail, audit-logs, calendar,
 *     media-library, notifications, consents, attachments, payments,
 *     and pre-flight error path on cases/[id]).
 *  2. Object overload — `toast({ title, description, type, duration,
 *     action })` renders the new two-line surface with optional CTA.
 *  3. Duration — `0` is sticky (no auto-dismiss), positive values dismiss
 *     after the requested ms.
 *  4. Action — clicking the CTA button fires `action.onClick`.
 *  5. Accessibility — error toasts get `role="alert"`, others get
 *     `role="status"` so screen readers pick up the difference.
 *  6. `useToast` outside a provider still throws.
 *  7. Multiple toasts coexist and dismiss independently.
 *
 * Test pattern (mirrors `tooltip.test.tsx`):
 *   - `vi.useFakeTimers({ shouldAdvanceTime: true })` keeps auto-dismiss
 *     timers deterministic without real-time waiting.
 *   - `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` +
 *     `await user.click(...)` flushes React state updates correctly under
 *     fake timers.
 *
 * @see docs/ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md §1.1 (TD-2 row)
 * @see docs/ux-redesign/STORY_TD_2_IMPLEMENTATION_REPORT.md
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '@/components/ui/toast';

// ---------- Helpers ----------

const actionClickSpy = vi.fn();

/** A button harness that exposes every `toast(...)` shape we want to verify. */
function Harness() {
  const { toast } = useToast();
  return (
    <>
      <button type="button" onClick={() => toast('legacy single-arg')}>
        legacy-default
      </button>
      <button type="button" onClick={() => toast('legacy error', 'error')}>
        legacy-error
      </button>
      <button type="button" onClick={() => toast({ title: 'Tiêu đề mới' })}>
        new-title-only
      </button>
      <button
        type="button"
        onClick={() =>
          toast({
            title: 'Lỗi mạng',
            description: 'Vui lòng kiểm tra kết nối rồi thử lại.',
            type: 'error',
          })
        }
      >
        new-title-desc
      </button>
      <button
        type="button"
        onClick={() => toast({ title: 'Sticky', duration: 0 })}
      >
        new-sticky
      </button>
      <button
        type="button"
        onClick={() => toast({ title: 'Quick', duration: 1000 })}
      >
        new-quick-dismiss
      </button>
      <button
        type="button"
        onClick={() =>
          toast({
            title: 'Đã gửi yêu cầu',
            description: 'Bạn có thể xem chi tiết case để theo dõi tiến độ.',
            type: 'success',
            action: { label: 'Xem case', onClick: () => actionClickSpy() },
          })
        }
      >
        new-action
      </button>
    </>
  );
}

// ---------- Setup ----------

beforeEach(() => {
  actionClickSpy.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

/** Render Harness inside ToastProvider wrapped in `act()` so the initial
 *  state-update from the provider's `useState` is flushed. */
function renderHarness() {
  let result!: ReturnType<typeof render>;
  act(() => {
    result = render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
  });
  return result;
}

/** Convenience: returns a `userEvent.setup` configured for fake timers. */
function setupUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

// ---------- 1. Backward compatibility ----------

describe('TD-2 — backward compatibility (legacy single-arg form)', () => {
  it('renders toast(\'Lưu thành công\') as a single-line info toast', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'legacy-default' }));

    const toast = screen.getByTestId('toast');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveAttribute('data-toast-type', 'info');
    expect(toast).toHaveTextContent('legacy single-arg');
    // Default type is info → status role, not alert.
    expect(toast).toHaveAttribute('role', 'status');
    // Description is NOT rendered when only a string was passed.
    expect(screen.queryByTestId('toast-description')).not.toBeInTheDocument();
  });

  it('renders toast(\'Lỗi\', \'error\') with the red error border and alert role', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'legacy-error' }));

    const toast = screen.getByTestId('toast');
    expect(toast).toHaveAttribute('data-toast-type', 'error');
    expect(toast).toHaveTextContent('legacy error');
    expect(toast).toHaveAttribute('role', 'alert');
    expect(toast.className).toMatch(/border-red-100/);
  });

  it('keeps rendering the close button (X) on legacy toasts', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'legacy-default' }));
    expect(screen.getByTestId('toast-close')).toBeInTheDocument();
  });

  it('auto-dismisses legacy toasts after the default 3500 ms', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'legacy-default' }));
    expect(screen.getByTestId('toast')).toBeInTheDocument();

    // Just past the default timeout.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500 + 50);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    });
  });

  it('manually dismisses a legacy toast when the X is clicked', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'legacy-default' }));
    await user.click(screen.getByTestId('toast-close'));
    await waitFor(() => {
      expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    });
  });
});

// ---------- 2. Object overload ----------

describe('TD-2 — object overload (new { title, description, type, duration, action } form)', () => {
  it('renders `title` when only `title` is provided', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'new-title-only' }));

    const toast = screen.getByTestId('toast');
    expect(toast).toHaveTextContent('Tiêu đề mới');
    expect(toast).toHaveAttribute('data-toast-type', 'info');
    // No description was passed → not rendered.
    expect(screen.queryByTestId('toast-description')).not.toBeInTheDocument();
  });

  it('renders two-line toast with `title` + `description`', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'new-title-desc' }));

    expect(screen.getByTestId('toast')).toHaveTextContent('Lỗi mạng');
    const description = screen.getByTestId('toast-description');
    expect(description).toBeInTheDocument();
    expect(description).toHaveTextContent('Vui lòng kiểm tra kết nối rồi thử lại.');
    // Description uses muted copy per the design system.
    expect(description.className).toMatch(/text-gray-500/);
    expect(description.className).toMatch(/text-xs/);
  });

  it('honors `type` override (success / error / info)', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'new-title-desc' }));
    const toast = screen.getByTestId('toast');
    expect(toast).toHaveAttribute('data-toast-type', 'error');
    expect(toast).toHaveAttribute('role', 'alert');
    expect(toast.className).toMatch(/border-red-100/);
  });

  it('defaults `type` to `info` when omitted', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'new-title-only' }));
    const toast = screen.getByTestId('toast');
    expect(toast).toHaveAttribute('data-toast-type', 'info');
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast.className).toMatch(/border-swan-100/);
  });
});

// ---------- 3. Duration ----------

describe('TD-2 — duration (sticky + explicit ms)', () => {
  it('duration: 0 renders a sticky toast (no auto-dismiss)', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'new-sticky' }));
    const toast = screen.getByTestId('toast');
    expect(toast).toHaveAttribute('data-toast-sticky', 'true');

    // Advance well past the default 3500 ms — sticky toast must survive.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.queryByTestId('toast')).toBeInTheDocument();

    // Sticky toasts do NOT render the shrinking progress bar.
    expect(document.querySelector('.animate-shrink')).not.toBeInTheDocument();
  });

  it('duration: 1000 auto-dismisses at ~1000 ms', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'new-quick-dismiss' }));
    expect(screen.getByTestId('toast')).toBeInTheDocument();

    // Just before dismissal — must still be visible.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(screen.queryByTestId('toast')).toBeInTheDocument();

    // Past dismissal — must be gone.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    await waitFor(() => {
      expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    });
  });

  it('default duration (no `duration` provided) is ~3500 ms — survives at 1000 ms and dismisses by 4000 ms', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'new-title-only' }));
    expect(screen.getByTestId('toast')).toBeInTheDocument();

    // 1000 ms — the default-3500-ms toast is still alive here.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.queryByTestId('toast')).toBeInTheDocument();

    // Advance well past the default — toast must be gone.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    await waitFor(() => {
      expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    });
  });
});

// ---------- 4. Action button ----------

describe('TD-2 — action button', () => {
  it('renders the action label when `action.label` is provided', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'new-action' }));
    expect(screen.getByTestId('toast-action')).toHaveTextContent('Xem case');
  });

  it('fires `action.onClick` when the action button is clicked', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'new-action' }));
    await user.click(screen.getByTestId('toast-action'));
    expect(actionClickSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT auto-dismiss the toast after the action is clicked', async () => {
    const user = setupUser();
    renderHarness();
    // `new-action` triggers a default-duration (3500 ms) toast.
    await user.click(screen.getByRole('button', { name: 'new-action' }));
    await user.click(screen.getByTestId('toast-action'));
    // Still present immediately after action.
    expect(screen.getByTestId('toast')).toBeInTheDocument();
    expect(actionClickSpy).toHaveBeenCalledTimes(1);
  });

  it('honors explicit duration=0 (sticky) with an action button', async () => {
    function StickyHarness() {
      const { toast } = useToast();
      return (
        <button
          type="button"
          onClick={() =>
            toast({
              title: 'Consent đã thu hồi',
              description: 'Ảnh case này sẽ bị ẩn khỏi thư viện sau khi đóng thông báo.',
              type: 'info',
              duration: 0,
              action: { label: 'Hoàn tác', onClick: () => actionClickSpy() },
            })
          }
        >
          sticky-action
        </button>
      );
    }
    act(() => {
      render(
        <ToastProvider>
          <StickyHarness />
        </ToastProvider>,
      );
    });
    const user = setupUser();
    await user.click(screen.getByRole('button', { name: 'sticky-action' }));
    expect(screen.getByTestId('toast-action')).toBeInTheDocument();
    await user.click(screen.getByTestId('toast-action'));
    expect(actionClickSpy).toHaveBeenCalledTimes(1);
    // Still alive far past the default timeout — sticky.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.queryByTestId('toast')).toBeInTheDocument();
  });
});

// ---------- 5. Accessibility ----------

describe('TD-2 — accessibility', () => {
  it('error toasts expose role="alert" + aria-live="assertive"', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'legacy-error' }));
    const toast = screen.getByTestId('toast');
    expect(toast).toHaveAttribute('role', 'alert');
    expect(toast).toHaveAttribute('aria-live', 'assertive');
  });

  it('success / info toasts expose role="status" + aria-live="polite"', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'legacy-default' }));
    const toast = screen.getByTestId('toast');
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });

  it('the close (X) button has an accessible Vietnamese label', async () => {
    const user = setupUser();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'legacy-default' }));
    expect(screen.getByTestId('toast-close')).toHaveAttribute(
      'aria-label',
      'Đóng thông báo',
    );
  });
});

// ---------- 6. useToast invariant ----------

describe('TD-2 — useToast invariant', () => {
  it('throws a clear error when `useToast` is called outside a ToastProvider', () => {
    // Suppress the boundary React error so the test stays focused.
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    function NakedConsumer() {
      useToast();
      return null;
    }
    expect(() => render(<NakedConsumer />)).toThrow(/ToastProvider/);
    consoleErrorSpy.mockRestore();
  });
});

// ---------- 7. Multiple toasts coexist ----------

describe('TD-2 — multiple toasts', () => {
  it('renders multiple toasts simultaneously and dismisses them independently', async () => {
    const user = setupUser();
    renderHarness();
    // Fire three different toasts:
    //  - new-quick-dismiss (1000 ms)
    //  - legacy-default (3500 ms, info)
    //  - new-title-desc (3500 ms, error)
    await user.click(screen.getByRole('button', { name: 'new-quick-dismiss' }));
    await user.click(screen.getByRole('button', { name: 'legacy-default' }));
    await user.click(screen.getByRole('button', { name: 'new-title-desc' }));

    const toasts = screen.getAllByTestId('toast');
    expect(toasts).toHaveLength(3);

    // Wait for the quick-dismiss one to vanish, others remain.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    await waitFor(() => {
      expect(screen.getAllByTestId('toast')).toHaveLength(2);
    });

    // The remaining two should still be visible until the default 3500 ms.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2400);
    });
    await waitFor(() => {
      expect(screen.queryAllByTestId('toast')).toHaveLength(0);
    });
  });
});
