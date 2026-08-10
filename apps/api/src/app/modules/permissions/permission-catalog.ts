export type ConfigurableRole = 'Operations' | 'Accounting' | 'Housekeeping';

export const CONFIGURABLE_ROLES: ConfigurableRole[] = ['Operations', 'Accounting', 'Housekeeping'];

export interface PermissionDefinition {
  key: string;
  module: string;
  label: string;
  /** Roles not listed here default to false. */
  defaults: Partial<Record<ConfigurableRole, boolean>>;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    key: 'villas.read',
    module: 'Villalar',
    label: 'Villaları görüntüle',
    defaults: { Operations: true, Accounting: true, Housekeeping: true },
  },
  {
    key: 'villas.write',
    module: 'Villalar',
    label: 'Villa/kat oluştur, düzenle, aktif-pasif et, sil',
    defaults: {},
  },
  {
    key: 'reservations.read',
    module: 'Rezervasyonlar',
    label: 'Rezervasyonları görüntüle',
    defaults: { Operations: true, Accounting: true, Housekeeping: true },
  },
  {
    key: 'reservations.write',
    module: 'Rezervasyonlar',
    label: 'Rezervasyon oluştur, düzenle, durum değiştir',
    defaults: { Operations: true },
  },
  {
    key: 'reservations.delete',
    module: 'Rezervasyonlar',
    label: 'Rezervasyon sil',
    defaults: {},
  },
  {
    key: 'customers.read',
    module: 'Müşteriler',
    label: 'Müşterileri görüntüle',
    defaults: { Operations: true, Accounting: true, Housekeeping: true },
  },
  {
    key: 'customers.write',
    module: 'Müşteriler',
    label: 'Müşteri oluştur, düzenle',
    defaults: { Operations: true },
  },
  {
    key: 'customers.delete',
    module: 'Müşteriler',
    label: 'Müşteri sil',
    defaults: {},
  },
  {
    key: 'housekeeping.read',
    module: 'Temizlik',
    label: 'Temizlik görevlerini görüntüle',
    defaults: { Operations: true, Accounting: true, Housekeeping: true },
  },
  {
    key: 'housekeeping.write',
    module: 'Temizlik',
    label: 'Temizlik görevi oluştur, başlat, tamamla',
    defaults: { Housekeeping: true },
  },
  {
    key: 'maintenance.read',
    module: 'Bakım',
    label: 'Bakım kayıtlarını görüntüle',
    defaults: { Operations: true, Accounting: true, Housekeeping: true },
  },
  {
    key: 'maintenance.write',
    module: 'Bakım',
    label: 'Bakım kaydı oluştur, başlat, tamamla',
    defaults: { Operations: true },
  },
  {
    key: 'payments.read',
    module: 'Ödemeler',
    label: 'Ödemeleri görüntüle',
    defaults: { Operations: true, Accounting: true, Housekeeping: true },
  },
  {
    key: 'payments.write',
    module: 'Ödemeler',
    label: 'Ödeme kaydı oluştur',
    defaults: { Accounting: true },
  },
  {
    key: 'expenses.read',
    module: 'Giderler',
    label: 'Giderleri görüntüle',
    defaults: { Operations: true, Accounting: true },
  },
  {
    key: 'expenses.write',
    module: 'Giderler',
    label: 'Gider kaydı oluştur, düzenle',
    defaults: { Accounting: true },
  },
  {
    key: 'expenses.delete',
    module: 'Giderler',
    label: 'Gider kaydı sil',
    defaults: {},
  },
  {
    key: 'dashboard.read',
    module: 'Dashboard',
    label: "Dashboard'u görüntüle",
    defaults: { Operations: true, Accounting: true, Housekeeping: true },
  },
  {
    key: 'reports.read',
    module: 'Raporlar',
    label: 'Raporları görüntüle',
    defaults: { Operations: true, Accounting: true, Housekeeping: true },
  },
  {
    key: 'settings.write',
    module: 'Ayarlar',
    label: 'Ayarları değiştir',
    defaults: {},
  },
  {
    key: 'users.manage',
    module: 'Kullanıcılar',
    label: 'Kullanıcı oluştur, rol/şifre değiştir, aktif-pasif et',
    defaults: {},
  },
];
