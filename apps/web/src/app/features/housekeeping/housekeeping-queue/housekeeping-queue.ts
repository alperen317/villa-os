import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../../core/auth/auth.service';
import {
  HOUSEKEEPING_STATUS_LABELS,
  HousekeepingStatus,
  HousekeepingTask,
} from '../../../core/models/housekeeping.model';
import { VillasStore } from '../../villas/villas.store';
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
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSkeletonModule,
    NzTagModule,
  ],
  templateUrl: './housekeeping-queue.html',
  styleUrl: './housekeeping-queue.scss',
})
export class HousekeepingQueue implements OnInit {
  private readonly housekeepingService = inject(HousekeepingService);
  private readonly villasStore = inject(VillasStore);
  private readonly authService = inject(AuthService);
  private readonly message = inject(NzMessageService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly statusLabels = HOUSEKEEPING_STATUS_LABELS;
  protected readonly columns = QUEUE_COLUMNS;

  protected readonly villas = this.villasStore.villas;
  protected readonly filterVillaId = signal<string | null>(null);

  protected readonly tasks = signal<HousekeepingTask[]>([]);
  protected readonly loading = signal(false);
  protected readonly actingTaskId = signal<string | null>(null);

  protected readonly modalVisible = signal(false);
  protected readonly modalSaving = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    villaId: ['', Validators.required],
    notes: [''],
  });

  protected readonly canManage = computed(() => {
    const role = this.authService.currentUser()?.role;
    return role ? MUTATE_ROLES.has(role) : false;
  });

  async ngOnInit(): Promise<void> {
    await this.villasStore.ensureLoaded();
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

  openCreateModal(): void {
    this.form.reset({ villaId: '', notes: '' });
    this.modalVisible.set(true);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    this.modalSaving.set(true);
    const value = this.form.getRawValue();

    try {
      await this.housekeepingService.create({ villaId: value.villaId, notes: value.notes || undefined });
      this.message.success('Temizlik görevi oluşturuldu');
      this.modalVisible.set(false);
      await this.loadTasks();
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    } finally {
      this.modalSaving.set(false);
    }
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

  private extractErrorMessage(error: unknown): string {
    const httpError = error as { error?: { message?: string | string[] } };
    const message = httpError?.error?.message;
    if (Array.isArray(message)) return message.join(', ');
    return message ?? 'İşlem başarısız oldu';
  }
}
