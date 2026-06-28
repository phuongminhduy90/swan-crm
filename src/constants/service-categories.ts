import { ServiceCategory } from '@/lib/types';

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  nose: 'Mũi',
  breast: 'Ngực',
  body: 'Cơ thể',
  eyes: 'Mắt',
  skin: 'Da',
  injectable: 'Tiêm',
  other: 'Khác',
};

export const SERVICE_CATEGORY_COLORS: Record<ServiceCategory, string> = {
  nose: 'bg-sky-100 text-sky-700',
  breast: 'bg-pink-100 text-pink-700',
  body: 'bg-indigo-100 text-indigo-700',
  eyes: 'bg-violet-100 text-violet-700',
  skin: 'bg-amber-100 text-amber-700',
  injectable: 'bg-teal-100 text-teal-700',
  other: 'bg-gray-100 text-gray-700',
};

export const ALL_SERVICE_CATEGORIES: ServiceCategory[] = [
  'nose',
  'breast',
  'body',
  'eyes',
  'skin',
  'injectable',
  'other',
];
