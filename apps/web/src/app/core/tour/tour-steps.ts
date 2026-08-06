import { UserRole } from '../auth/auth.model';

export interface TourStep {
  path: string;
  elementId: string;
  title: string;
  description: string;
  /** Roles that can see this step. Omit to show it to every authenticated role. */
  roles?: UserRole[];
}

const HOUSEKEEPING_ROLES: UserRole[] = ['Administrator', 'Operations', 'Housekeeping'];
const ADMIN_ONLY: UserRole[] = ['Administrator'];

export const TOUR_STEPS: TourStep[] = [
  {
    path: '/dashboard',
    elementId: 'tour-dashboard',
    title: 'Dashboard',
    description: "Villa OS'a hoş geldin! Bu kısa tur, uygulamadaki tüm modülleri tanıtacak.",
  },
  {
    path: '/dashboard',
    elementId: 'tour-dashboard-stats',
    title: 'Günlük Özet',
    description:
      'Bugünkü giriş/çıkış sayıları, doluluk oranı, aylık gelir ve bekleyen işler gibi anlık metrikleri buradan takip edersin — kartlara tıklayarak ilgili listeye geçebilirsin.',
  },
  {
    path: '/villas',
    elementId: 'tour-villas',
    title: 'Villalar',
    description: 'Villalarını ve katlarını (kiralanabilir birimlerini) buradan yönetir, durumlarını aktif/pasif olarak değiştirebilirsin.',
  },
  {
    path: '/villas',
    elementId: 'tour-villas-create',
    title: 'Yeni Villa Ekle',
    description: 'Buradan yeni bir villa oluşturur; adını, adresini ve katlarını tanımlayabilirsin.',
  },
  {
    path: '/reservations',
    elementId: 'tour-reservations',
    title: 'Rezervasyonlar',
    description: 'Rezervasyonları oluşturur, check-in/check-out yapar, iptal edebilir ve tüm rezervasyon geçmişini buradan görüntülersin.',
  },
  {
    path: '/reservations',
    elementId: 'tour-reservations-view',
    title: 'Görünüm Seçenekleri',
    description: 'Liste, takvim veya müsaitlik görünümleri arasında geçiş yaparak rezervasyonları farklı açılardan inceleyebilirsin.',
  },
  {
    path: '/customers',
    elementId: 'tour-customers',
    title: 'Müşteriler',
    description: 'Müşteri profillerini ve geçmiş rezervasyonlarını buradan yönetirsin.',
  },
  {
    path: '/customers',
    elementId: 'tour-customers-create',
    title: 'Yeni Müşteri Ekle',
    description: 'Yeni bir müşteri profili oluşturmak için bu butonu kullan.',
  },
  {
    path: '/housekeeping',
    elementId: 'tour-housekeeping',
    title: 'Temizlik',
    description: 'Temizlik görevlerini bekleyen, devam eden ve tamamlanan olarak kuyruk halinde görür, üstlenip tamamlayabilirsin.',
    roles: HOUSEKEEPING_ROLES,
  },
  {
    path: '/housekeeping',
    elementId: 'tour-housekeeping-actions',
    title: 'Filtrele ve Görev Aç',
    description: 'Villaya göre filtreleyebilir, rezervasyona bağlı olmayan ek bir temizlik görevini manuel olarak açabilirsin.',
    roles: HOUSEKEEPING_ROLES,
  },
  {
    path: '/maintenance',
    elementId: 'tour-maintenance',
    title: 'Bakım',
    description: 'Villalardaki bakım kayıtlarını (açık, devam eden, tamamlanan) buradan takip edersin.',
  },
  {
    path: '/maintenance',
    elementId: 'tour-maintenance-filters',
    title: 'Bakım Filtreleri',
    description: 'Villa, durum ve önceliğe göre filtreleyerek açık bakım kayıtlarını hızlıca bulabilirsin.',
  },
  {
    path: '/users',
    elementId: 'tour-users',
    title: 'Kullanıcılar',
    description: 'Sistem kullanıcılarını, rollerini ve aktiflik durumlarını buradan yönetirsin.',
    roles: ADMIN_ONLY,
  },
  {
    path: '/users',
    elementId: 'tour-users-create',
    title: 'Yeni Kullanıcı Ekle',
    description: 'Yeni bir kullanıcı oluşturup rolünü (Operasyon, Muhasebe, Temizlik, Yönetici) atayabilir, gerektiğinde şifresini sıfırlayabilirsin.',
    roles: ADMIN_ONLY,
  },
  {
    path: '/settings',
    elementId: 'tour-settings',
    title: 'Ayarlar — Marka',
    description: 'Şirket adını, logonu ve marka rengini buradan özelleştirirsin; marka rengi rapor grafiklerine de otomatik yansır.',
    roles: ADMIN_ONLY,
  },
  {
    path: '/settings',
    elementId: 'tour-settings-tabs',
    title: 'Ayarlar — İzinler',
    description: '"İzinler" sekmesinden her rolün (Operasyon, Muhasebe, Temizlik) hangi modülü görüntüleyip hangi işlemi yapabileceğini ayrıntılı şekilde yapılandırabilirsin.',
    roles: ADMIN_ONLY,
  },
];
