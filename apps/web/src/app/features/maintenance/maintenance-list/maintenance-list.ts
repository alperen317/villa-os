import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  MAINTENANCE_PRIORITY_LABELS,
  MAINTENANCE_STATUS_LABELS,
  MaintenancePriority,
  MaintenanceRecordWithVilla,
  MaintenanceStatus,
} from '../../../core/models/maintenance.model';
import { Villa } from '../../../core/models/villa.model';
import { VillasService } from '../../villas/villas.service';
import { MaintenanceService } from '../../villas/maintenance.service';

const PRIORITY_COLORS: Record<MaintenancePriority, string> = {
  Low: 'default',
  Medium: 'blue',
  High: 'orange',
  Urgent: 'red',
};

const STATUS_COLORS: Record<MaintenanceStatus, string> = {
  Open: 'gold',
  InProgress: 'blue',
  Completed: 'green',
};

@Component({
  selector: 'app-maintenance-list',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NzButtonModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './maintenance-list.html',
  styleUrl: './maintenance-list.scss',
})
export class MaintenanceList implements OnInit {
  private readonly maintenanceService = inject(MaintenanceService);
  private readonly villasService = inject(VillasService);
  private readonly message = inject(NzMessageService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly priorityLabels = MAINTENANCE_PRIORITY_LABELS;
  protected readonly statusLabels = MAINTENANCE_STATUS_LABELS;
  protected readonly priorityColors = PRIORITY_COLORS;
  protected readonly statusColors = STATUS_COLORS;
  protected readonly statusKeys = Object.keys(MAINTENANCE_STATUS_LABELS) as MaintenanceStatus[];
  protected readonly priorityKeys = Object.keys(MAINTENANCE_PRIORITY_LABELS) as MaintenancePriority[];

  protected readonly villas = signal<Villa[]>([]);
  protected readonly filterVillaId = signal<string | null>(null);
  protected readonly filterStatus = signal<MaintenanceStatus | null>(null);

  protected readonly records = signal<MaintenanceRecordWithVilla[]>([]);
  protected readonly loading = signal(false);
  protected readonly actingRecordId = signal<string | null>(null);

  protected readonly modalVisible = signal(false);
  protected readonly modalSaving = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    villaId: ['', Validators.required],
    title: ['', Validators.required],
    priority: ['Medium' as MaintenancePriority, Validators.required],
    description: [''],
  });

  async ngOnInit(): Promise<void> {
    const result = await this.villasService.list({ limit: 100 });
    this.villas.set(result.data);
    await this.loadRecords();
  }

  async loadRecords(): Promise<void> {
    this.loading.set(true);
    try {
      this.records.set(
        await this.maintenanceService.listAll({
          villaId: this.filterVillaId() ?? undefined,
          status: this.filterStatus() ?? undefined,
        }),
      );
    } catch {
      this.message.error('Bakım kayıtları alınamadı');
    } finally {
      this.loading.set(false);
    }
  }

  onFilterChange(): void {
    this.loadRecords();
  }

  openCreateModal(): void {
    this.form.reset({ villaId: '', title: '', priority: 'Medium', description: '' });
    this.modalVisible.set(true);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    this.modalSaving.set(true);
    const value = this.form.getRawValue();

    try {
      await this.maintenanceService.create(value.villaId, {
        title: value.title,
        priority: value.priority,
        description: value.description || undefined,
      });

      this.message.success('Bakım kaydı oluşturuldu');
      this.modalVisible.set(false);
      await this.loadRecords();
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    } finally {
      this.modalSaving.set(false);
    }
  }

  async start(record: MaintenanceRecordWithVilla): Promise<void> {
    this.actingRecordId.set(record.id);
    try {
      await this.maintenanceService.start(record.villaId, record.id);
      this.message.success('Bakım başlatıldı');
      await this.loadRecords();
    } catch {
      this.message.error('İşlem başarısız oldu');
    } finally {
      this.actingRecordId.set(null);
    }
  }

  async complete(record: MaintenanceRecordWithVilla): Promise<void> {
    this.actingRecordId.set(record.id);
    try {
      await this.maintenanceService.complete(record.villaId, record.id);
      this.message.success('Bakım tamamlandı');
      await this.loadRecords();
    } catch {
      this.message.error('İşlem başarısız oldu');
    } finally {
      this.actingRecordId.set(null);
    }
  }

  private extractErrorMessage(error: unknown): string {
    const httpError = error as { error?: { message?: string | string[] } };
    const message = httpError?.error?.message;
    if (Array.isArray(message)) return message.join(', ');
    return message ?? 'İşlem başarısız oldu';
  }
}
