import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../../core/auth/auth.service';
import {
  HOUSEKEEPING_STATUS_LABELS,
  HousekeepingStatus,
  HousekeepingTask,
} from '../../../core/models/housekeeping.model';
import { Villa } from '../../../core/models/villa.model';
import { VillasService } from '../../villas/villas.service';
import { HousekeepingService } from '../housekeeping.service';

const MUTATE_ROLES = new Set(['Administrator', 'Housekeeping']);

const QUEUE_COLUMNS: { status: HousekeepingStatus; title: string }[] = [
  { status: 'Pending', title: 'Bekliyor' },
  { status: 'InProgress', title: 'Temizleniyor' },
  { status: 'Completed', title: 'Tamamlandı' },
];

@Component({
  selector: 'app-housekeeping-queue',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzIconModule,
    NzSelectModule,
    NzSkeletonModule,
    NzTagModule,
  ],
  templateUrl: './housekeeping-queue.html',
  styleUrl: './housekeeping-queue.scss',
})
export class HousekeepingQueue implements OnInit {
  private readonly housekeepingService = inject(HousekeepingService);
  private readonly villasService = inject(VillasService);
  private readonly authService = inject(AuthService);
  private readonly message = inject(NzMessageService);

  protected readonly statusLabels = HOUSEKEEPING_STATUS_LABELS;
  protected readonly columns = QUEUE_COLUMNS;

  protected readonly villas = signal<Villa[]>([]);
  protected readonly filterVillaId = signal<string | null>(null);

  protected readonly tasks = signal<HousekeepingTask[]>([]);
  protected readonly loading = signal(false);
  protected readonly actingTaskId = signal<string | null>(null);

  protected readonly canManage = computed(() => {
    const role = this.authService.currentUser()?.role;
    return role ? MUTATE_ROLES.has(role) : false;
  });

  async ngOnInit(): Promise<void> {
    const result = await this.villasService.list({ limit: 100 });
    this.villas.set(result.data);
    await this.loadTasks();
  }

  async loadTasks(): Promise<void> {
    this.loading.set(true);
    try {
      this.tasks.set(await this.housekeepingService.list({ villaId: this.filterVillaId() ?? undefined }));
    } catch {
      this.message.error('Temizlik görevleri alınamadı');
    } finally {
      this.loading.set(false);
    }
  }

  onFilterChange(): void {
    this.loadTasks();
  }

  tasksForStatus(status: HousekeepingStatus): HousekeepingTask[] {
    return this.tasks().filter((task) => task.status === status);
  }

  async start(task: HousekeepingTask): Promise<void> {
    this.actingTaskId.set(task.id);
    try {
      await this.housekeepingService.start(task.id);
      this.message.success('Temizlik başlatıldı');
      await this.loadTasks();
    } catch {
      this.message.error('İşlem başarısız oldu');
    } finally {
      this.actingTaskId.set(null);
    }
  }

  async complete(task: HousekeepingTask): Promise<void> {
    this.actingTaskId.set(task.id);
    try {
      await this.housekeepingService.complete(task.id);
      this.message.success('Temizlik tamamlandı');
      await this.loadTasks();
    } catch {
      this.message.error('İşlem başarısız oldu');
    } finally {
      this.actingTaskId.set(null);
    }
  }
}
