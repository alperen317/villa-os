export interface Settings {
  id: string;
  companyName: string;
  logoPath: string | null;
  accentColor: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  updatedAt: string;
}

export interface UpdateSettingsInput {
  companyName?: string;
  accentColor?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
}
