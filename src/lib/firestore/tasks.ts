import { Task, CreateTaskInput } from '@/lib/types';
import {
  getDocument,
  setDocument,
  updateDocument,
  getAllDocuments,
} from '@/lib/firebase/firestore';

const COLLECTION = 'tasks';

export async function getTask(id: string): Promise<Task | null> {
  const data = await getDocument<Record<string, unknown>>(COLLECTION, id);
  if (!data) return null;
  return data as unknown as Task;
}

export async function getAllTasks(): Promise<Task[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION);
  return (data as unknown as Task[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getTasksByCase(caseId: string): Promise<Task[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION, [
    { field: 'caseId', operator: '==', value: caseId },
  ]);
  return data as unknown as Task[];
}

export async function getTasksForUser(userId: string): Promise<Task[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION, [
    { field: 'assignedTo', operator: '==', value: userId },
  ]);
  return data as unknown as Task[];
}

export async function createTask(
  input: CreateTaskInput,
  createdBy: string,
): Promise<Task> {
  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const task: Task = {
    id,
    title: input.title,
    description: input.description,
    caseId: input.caseId,
    customerId: input.customerId,
    assignedTo: input.assignedTo,
    assignedRole: input.assignedRole,
    department: input.department,
    dueDate: input.dueDate,
    priority: input.priority ?? 'normal',
    status: 'todo',
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await setDocument(COLLECTION, id, task);
  return task;
}

export async function updateTaskStatus(
  id: string,
  status: Task['status'],
  updatedBy: string,
): Promise<void> {
  const now = new Date().toISOString();
  await updateDocument(COLLECTION, id, {
    status,
    updatedBy,
    ...(status === 'done' ? { completedAt: now } : {}),
  });
}

export async function updateTask(id: string, data: Partial<Task>): Promise<void> {
  await updateDocument(COLLECTION, id, data);
}
