import { z } from 'zod';

const locationTypes = ['swan', 'cih', 'medika', 'other_hospital'] as const;

export const createTreatmentLocationSchema = z.object({
  name: z.string().min(2, 'Tên địa điểm phải có ít nhất 2 ký tự').max(200),
  type: z.enum(locationTypes, { required_error: 'Vui lòng chọn loại địa điểm' }),
  address: z.string().max(500).optional().or(z.literal('')),
  contactPerson: z.string().max(200).optional().or(z.literal('')),
  contactPhone: z.string().max(20).optional().or(z.literal('')),
  note: z.string().optional().or(z.literal('')),
});

export const updateTreatmentLocationSchema = createTreatmentLocationSchema.partial();

export type CreateTreatmentLocationFormValues = z.infer<typeof createTreatmentLocationSchema>;
export type UpdateTreatmentLocationFormValues = z.infer<typeof updateTreatmentLocationSchema>;

export const LOCATION_TYPE_LABELS: Record<string, string> = {
  swan: 'Swan Clinic',
  cih: 'Bệnh viện CIH',
  medika: 'Bệnh viện Medika',
  other_hospital: 'Bệnh viện khác',
};

export const LOCATION_TYPE_COLORS: Record<string, string> = {
  swan: 'bg-swan-100 text-swan-700',
  cih: 'bg-blue-100 text-blue-700',
  medika: 'bg-purple-100 text-purple-700',
  other_hospital: 'bg-gray-100 text-gray-600',
};

export const ALL_LOCATION_TYPES = locationTypes;
