export type ConfigurableRole = 'Operations' | 'Accounting' | 'Housekeeping';

export interface PermissionRow {
  key: string;
  module: string;
  label: string;
  values: Record<ConfigurableRole, boolean>;
}

export interface PermissionUpdate {
  role: ConfigurableRole;
  permissionKey: string;
  allowed: boolean;
}
