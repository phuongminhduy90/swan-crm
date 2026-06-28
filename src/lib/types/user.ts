export type UserRole =
  | 'admin'
  | 'ceo'
  | 'cso'
  | 'master_sales'
  | 'sales_online'
  | 'sales_offline'
  | 'accountant'
  | 'doctor'
  | 'nurse'
  | 'coordinator'
  | 'cskh_postop'
  | 'media';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  phone?: string;
}

export interface UpdateUserInput {
  displayName?: string;
  role?: UserRole;
  phone?: string;
  isActive?: boolean;
}