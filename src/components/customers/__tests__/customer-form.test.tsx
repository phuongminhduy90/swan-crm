import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import type { User, UserRole } from '@/lib/types';
import { CustomerForm } from '@/components/customers/customer-form';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUseCurrentUser = vi.fn();
vi.mock('@/lib/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

function makeUser(role: UserRole): User {
  return {
    id: `dev-${role}`,
    email: `${role}@swanclinic.vn`,
    displayName: `Dev ${role}`,
    role,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const noopAsync = async () => {};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CustomerForm — CCCD section (Story B.1.1)', () => {
  beforeEach(() => {
    mockUseCurrentUser.mockReturnValue({ user: makeUser('admin') });
  });

  describe('RBAC visibility', () => {
    it('renders "Giấy tờ tùy thân" section for admin (in SENSITIVE_FIELD_ACCESS_ROLES)', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('admin') });
      render(<CustomerForm onSubmit={noopAsync} onCancel={() => {}} />);

      expect(screen.getByRole('heading', { name: /giấy tờ tùy thân/i })).toBeInTheDocument();
      // The three labeled inputs render inside this section.
      expect(screen.getByLabelText(/số cmnd\/cccd/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/ngày cấp/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/nơi cấp/i)).toBeInTheDocument();
    });

    it('renders the section for sales_online', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('sales_online') });
      render(<CustomerForm onSubmit={noopAsync} onCancel={() => {}} />);

      expect(screen.getByRole('heading', { name: /giấy tờ tùy thân/i })).toBeInTheDocument();
    });

    it('renders the section for doctor', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('doctor') });
      render(<CustomerForm onSubmit={noopAsync} onCancel={() => {}} />);

      expect(screen.getByRole('heading', { name: /giấy tờ tùy thân/i })).toBeInTheDocument();
    });

    it('hides the section for media (NOT in SENSITIVE_FIELD_ACCESS_ROLES)', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('media') });
      render(<CustomerForm onSubmit={noopAsync} onCancel={() => {}} />);

      expect(screen.queryByRole('heading', { name: /giấy tờ tùy thân/i })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/số cmnd\/cccd/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/ngày cấp/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/nơi cấp/i)).not.toBeInTheDocument();
    });

    it('hides the section for accountant (NOT in SENSITIVE_FIELD_ACCESS_ROLES)', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('accountant') });
      render(<CustomerForm onSubmit={noopAsync} onCancel={() => {}} />);

      expect(screen.queryByRole('heading', { name: /giấy tờ tùy thân/i })).not.toBeInTheDocument();
    });

    it('hides the section for cskh_postop (NOT in SENSITIVE_FIELD_ACCESS_ROLES)', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('cskh_postop') });
      render(<CustomerForm onSubmit={noopAsync} onCancel={() => {}} />);

      expect(screen.queryByRole('heading', { name: /giấy tờ tùy thân/i })).not.toBeInTheDocument();
    });

    it('hides the section for nurse (NOT in SENSITIVE_FIELD_ACCESS_ROLES)', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('nurse') });
      render(<CustomerForm onSubmit={noopAsync} onCancel={() => {}} />);

      expect(screen.queryByRole('heading', { name: /giấy tờ tùy thân/i })).not.toBeInTheDocument();
    });

    it('hides the section when no user is authenticated', () => {
      mockUseCurrentUser.mockReturnValue({ user: null });
      render(<CustomerForm onSubmit={noopAsync} onCancel={() => {}} />);

      expect(screen.queryByRole('heading', { name: /giấy tờ tùy thân/i })).not.toBeInTheDocument();
    });
  });

  describe('persistence round-trip (B.1.1 DoD)', () => {
    it('preserves existing CCCD initialData when admin opens edit', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('admin') });
      render(
        <CustomerForm
          initialData={{
            fullName: 'Nguyễn Thị Lan',
            phone: '0901234567',
            nationalIdNumber: '001234567890',
            nationalIdIssueDate: '2020-05-12',
            nationalIdIssuePlace: 'Công an Hà Nội',
          }}
          onSubmit={noopAsync}
          onCancel={() => {}}
        />,
      );

      expect(screen.getByLabelText(/số cmnd\/cccd/i)).toHaveValue('001234567890');
      expect(screen.getByLabelText(/ngày cấp/i)).toHaveValue('2020-05-12');
      expect(screen.getByLabelText(/nơi cấp/i)).toHaveValue('Công an Hà Nội');
    });

    it('admin can update CCCD field and submit reflects the change', async () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('admin') });
      const user = userEvent.setup();
      const onSubmit = vi.fn(noopAsync);

      render(
        <CustomerForm
          initialData={{
            id: 'cust-existing-1',
            fullName: 'Trần Văn B',
            phone: '0901234567',
            nationalIdNumber: '123456789',
          }}
          onSubmit={onSubmit}
          onCancel={() => {}}
        />,
      );

      const cccdInput = screen.getByLabelText(/số cmnd\/cccd/i);
      await user.clear(cccdInput);
      await user.type(cccdInput, '001999888777');

      // Submit (button text is "Cập nhật" when initialData.id is set)
      await user.click(screen.getByRole('button', { name: /cập nhật/i }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const submittedData = onSubmit.mock.calls[0][0];
      expect(submittedData.nationalIdNumber).toBe('001999888777');
      // Existing initialData values are preserved.
      expect(submittedData.nationalIdIssueDate).toBe('');
      expect(submittedData.nationalIdIssuePlace).toBe('');
    });

    it('preserves existing CCCD in submission even when section is hidden (no overwrite)', async () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('media') });
      const user = userEvent.setup();
      const onSubmit = vi.fn(noopAsync);

      render(
        <CustomerForm
          initialData={{
            id: 'cust-existing-2',
            fullName: 'Lê Thị C',
            phone: '0901234567',
            nationalIdNumber: '001234567890',
            nationalIdIssueDate: '2019-01-01',
            nationalIdIssuePlace: 'Công an TP.HCM',
          }}
          onSubmit={onSubmit}
          onCancel={() => {}}
        />,
      );

      // Section is hidden for media.
      expect(screen.queryByLabelText(/số cmnd\/cccd/i)).not.toBeInTheDocument();

      // Submit edit (e.g., update name only).
      const nameInput = screen.getByLabelText(/^họ tên \*/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Lê Thị C Updated');
      await user.click(screen.getByRole('button', { name: /cập nhật/i }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const submitted = onSubmit.mock.calls[0][0];
      // CCCD values pass through untouched (initialData values, NOT empty string).
      expect(submitted.nationalIdNumber).toBe('001234567890');
      expect(submitted.nationalIdIssueDate).toBe('2019-01-01');
      expect(submitted.nationalIdIssuePlace).toBe('Công an TP.HCM');
      // The edited name is reflected.
      expect(submitted.fullName).toBe('Lê Thị C Updated');
    });
  });

  describe('form interaction', () => {
    it('shows hint text "Để trống nếu khách chưa cung cấp" below the CCCD input', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('admin') });
      render(<CustomerForm onSubmit={noopAsync} onCancel={() => {}} />);

      expect(screen.getByText(/để trống nếu khách chưa cung cấp/i)).toBeInTheDocument();
    });

    it('shows a "vai trò được phép" disclaimer inside the section', () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('admin') });
      render(<CustomerForm onSubmit={noopAsync} onCancel={() => {}} />);

      expect(screen.getByText(/vai trò được phép truy cập giấy tờ nhạy cảm/i)).toBeInTheDocument();
    });

    it('cancel button calls onCancel', async () => {
      mockUseCurrentUser.mockReturnValue({ user: makeUser('admin') });
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<CustomerForm onSubmit={noopAsync} onCancel={onCancel} />);

      await user.click(screen.getByRole('button', { name: /hủy/i }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});