import { ServiceCategory } from './case';

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  defaultPrice?: number;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceInput {
  name: string;
  category: ServiceCategory;
  defaultPrice?: number;
  description?: string;
}
