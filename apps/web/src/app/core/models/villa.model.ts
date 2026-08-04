export type VillaStatus = 'Active' | 'Inactive';

export interface Villa {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: VillaStatus;
  createdAt: string;
  updatedAt: string;
  hasOpenMaintenance?: boolean;
}

export interface CreateVillaInput {
  name: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export type UpdateVillaInput = Partial<CreateVillaInput>;

export interface Floor {
  id: string;
  villaId: string;
  name: string;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  dailyPrice: string;
  rentable: boolean;
  isEntireVilla: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFloorInput {
  name: string;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  dailyPrice: number;
  rentable?: boolean;
  isEntireVilla?: boolean;
}

export type UpdateFloorInput = Partial<CreateFloorInput>;

export interface FloorWithVilla extends Floor {
  villa: { id: string; name: string };
}
