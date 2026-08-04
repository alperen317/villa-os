import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  MAINTENANCE_PRIORITY_LABELS,
  MAINTENANCE_STATUS_LABELS,
  MaintenancePriority,
  MaintenanceRecord,
} from '../../../core/models/maintenance.model';
import { Floor, Villa } from '../../../core/models/villa.model';
import { MaintenanceService } from '../maintenance.service';
import { VillasService } from '../villas.service';

const PRIORITY_COLORS: Record<MaintenancePriority, string> = {
  Low: 'default',
  Medium: 'blue',
  High: 'orange',
  Urgent: 'red',
};

const MAINTENANCE_STATUS_COLORS: Record<MaintenanceRecord['status'], string> = {
  Open: 'gold',
  InProgress: 'blue',
  Completed: 'green',
};

@Component({
  selector: 'app-villa-detail',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDescriptionsModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSkeletonModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './villa-detail.html',
  styleUrl: './villa-detail.scss',
})
export class VillaDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly villasService = inject(VillasService);
  private readonly maintenanceService = inject(MaintenanceService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly message = inject(NzMessageService);

  protected readonly villa = signal<Villa | null>(null);
  protected readonly floors = signal<Floor[]>([]);
  protected readonly loading = signal(false);

  protected readonly modalVisible = signal(false);
  protected readonly modalSaving = signal(false);
  protected editingFloor: Floor | null = null;

  protected readonly priorityLabels = MAINTENANCE_PRIORITY_LABELS;
  protected readonly statusLabels = MAINTENANCE_STATUS_LABELS;
  protected readonly priorityColors = PRIORITY_COLORS;
  protected readonly maintenanceStatusColors = MAINTENANCE_STATUS_COLORS;
  protected readonly priorityKeys = Object.keys(MAINTENANCE_PRIORITY_LABELS) as MaintenancePriority[];

  protected readonly maintenanceRecords = signal<MaintenanceRecord[]>([]);
  protected readonly maintenanceLoading = signal(false);
  protected readonly maintenanceModalVisible = signal(false);
  protected readonly maintenanceSaving = signal(false);
  protected readonly maintenanceActingId = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    capacity: [1, [Validators.required, Validators.min(1)]],
    bedrooms: [1, [Validators.required, Validators.min(0)]],
    bathrooms: [1, [Validators.required, Validators.min(0)]],
    dailyPrice: [0, [Validators.required, Validators.min(0)]],
    rentable: [true],
    isEntireVilla: [false],
  });

  protected readonly maintenanceForm = this.formBuilder.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    priority: ['Medium' as MaintenancePriority, Validators.required],
  });

  private get villaId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.load();
    this.loadMaintenanceRecords();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [villa, floors] = await Promise.all([
        this.villasService.get(this.villaId),
        this.villasService.listFloors(this.villaId),
      ]);
      this.villa.set(villa);
      this.floors.set(floors);
    } finally {
      this.loading.set(false);
    }
  }

  async loadMaintenanceRecords(): Promise<void> {
    this.maintenanceLoading.set(true);
    try {
      this.maintenanceRecords.set(await this.maintenanceService.list(this.villaId));
    } catch {
      this.message.error('Bakım kayıtları alınamadı');
    } finally {
      this.maintenanceLoading.set(false);
    }
  }

  openCreateMaintenanceModal(): void {
    this.maintenanceForm.reset({ title: '', description: '', priority: 'Medium' });
    this.maintenanceModalVisible.set(true);
  }

  async saveMaintenanceRecord(): Promise<void> {
    if (this.maintenanceForm.invalid) {
      return;
    }

    const value = this.maintenanceForm.getRawValue();

    this.maintenanceSaving.set(true);
    try {
      await this.maintenanceService.create(this.villaId, {
        title: value.title,
        description: value.description || undefined,
        priority: value.priority,
      });

      this.message.success('Bakım kaydı oluşturuldu');
      this.maintenanceModalVisible.set(false);
      await this.loadMaintenanceRecords();
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    } finally {
      this.maintenanceSaving.set(false);
    }
  }

  async startMaintenance(record: MaintenanceRecord): Promise<void> {
    this.maintenanceActingId.set(record.id);
    try {
      await this.maintenanceService.start(this.villaId, record.id);
      await this.loadMaintenanceRecords();
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    } finally {
      this.maintenanceActingId.set(null);
    }
  }

  async completeMaintenance(record: MaintenanceRecord): Promise<void> {
    this.maintenanceActingId.set(record.id);
    try {
      await this.maintenanceService.complete(this.villaId, record.id);
      await this.loadMaintenanceRecords();
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    } finally {
      this.maintenanceActingId.set(null);
    }
  }

  openCreateModal(): void {
    this.editingFloor = null;
    this.form.reset({
      name: '',
      capacity: 1,
      bedrooms: 1,
      bathrooms: 1,
      dailyPrice: 0,
      rentable: true,
      isEntireVilla: false,
    });
    this.modalVisible.set(true);
  }

  openEditModal(floor: Floor): void {
    this.editingFloor = floor;
    this.form.reset({
      name: floor.name,
      capacity: floor.capacity,
      bedrooms: floor.bedrooms,
      bathrooms: floor.bathrooms,
      dailyPrice: Number(floor.dailyPrice),
      rentable: floor.rentable,
      isEntireVilla: floor.isEntireVilla,
    });
    this.modalVisible.set(true);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    this.modalSaving.set(true);
    const value = this.form.getRawValue();

    try {
      if (this.editingFloor) {
        await this.villasService.updateFloor(this.villaId, this.editingFloor.id, value);
        this.message.success('Kat güncellendi');
      } else {
        await this.villasService.createFloor(this.villaId, value);
        this.message.success('Kat eklendi');
      }

      this.modalVisible.set(false);
      await this.load();
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    } finally {
      this.modalSaving.set(false);
    }
  }

  async removeFloor(floor: Floor): Promise<void> {
    try {
      await this.villasService.removeFloor(this.villaId, floor.id);
      this.message.success('Kat silindi');
      await this.load();
    } catch {
      this.message.error('Kat silinemedi');
    }
  }

  async toggleVillaStatus(): Promise<void> {
    const villa = this.villa();
    if (!villa) return;

    try {
      if (villa.status === 'Active') {
        await this.villasService.deactivate(villa.id);
      } else {
        await this.villasService.activate(villa.id);
      }
      await this.load();
    } catch {
      this.message.error('Durum değiştirilemedi');
    }
  }

  private extractErrorMessage(error: unknown): string {
    const httpError = error as { error?: { message?: string | string[] } };
    const message = httpError?.error?.message;
    if (Array.isArray(message)) return message.join(', ');
    return message ?? 'İşlem başarısız oldu';
  }
}
