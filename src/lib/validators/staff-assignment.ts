import { z } from 'zod';

export const updateStaffAssignmentSchema = z.object({
  masterSalesId: z.string().optional().or(z.null()),
  salesOnlineId: z.string().optional().or(z.null()),
  salesOfflineId: z.string().optional().or(z.null()),
  accountantId: z.string().optional().or(z.null()),
  doctorId: z.string().optional().or(z.null()),
  nurseIds: z.array(z.string()).optional(),
  coordinatorId: z.string().optional().or(z.null()),
  cskhPostopId: z.string().optional().or(z.null()),
  mediaId: z.string().optional().or(z.null()),
});

export type UpdateStaffAssignmentFormValues = z.infer<typeof updateStaffAssignmentSchema>;
