export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  identityNumber: string | null;
  passportNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  identityNumber?: string;
  passportNumber?: string;
  notes?: string;
}
