import { User, UserRole } from '@/lib/types';
import { ALL_ROLES } from '@/config/roles';

function makeMockUser(role: UserRole): User {
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

export const MOCK_USERS: Record<UserRole, User> = ALL_ROLES.reduce(
  (acc, role) => {
    acc[role] = makeMockUser(role);
    return acc;
  },
  {} as Record<UserRole, User>,
);

export function getMockUserByRole(role: UserRole): User {
  return MOCK_USERS[role];
}