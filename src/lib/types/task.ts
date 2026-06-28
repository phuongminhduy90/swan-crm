import { UserRole } from './user';

export type TaskDepartment =
  | 'sales'
  | 'accounting'
  | 'medical'
  | 'nursing'
  | 'coordination'
  | 'postop'
  | 'media'
  | 'management';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'overdue' | 'cancelled';

export interface Task {
  id: string;

  title: string;
  description?: string;

  caseId?: string;
  customerId?: string;

  assignedTo?: string;
  assignedRole?: UserRole;
  department?: TaskDepartment;

  dueDate?: string;
  priority: TaskPriority;

  status: TaskStatus;

  createdBy: string;
  createdAt: string;
  completedAt?: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  caseId?: string;
  customerId?: string;
  assignedTo?: string;
  assignedRole?: UserRole;
  department?: TaskDepartment;
  dueDate?: string;
  priority?: TaskPriority;
}
