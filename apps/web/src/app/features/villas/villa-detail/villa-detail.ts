import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Floor, Villa } from '../../../core/models/villa.model';
import { VillasService } from '../villas.service';

@Component({
  selector: 'app-villa-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './villa-detail.html',
  styleUrl: './villa-detail.scss',
})
export class VillaDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly villasService = inject(VillasService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly message = inject(NzMessageService);

  protected readonly villa = signal<Villa | null>(null);
  protected readonly floors = signal<Floor[]>([]);
  protected readonly loading = signal(false);

  protected readonly modalVisible = signal(false);
  protected readonly modalSaving = signal(false);
  protected editingFloor: Floor | null = null;

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    capacity: [1, [Validators.required, Validators.min(1)]],
    bedrooms: [1, [Validators.required, Validators.min(0)]],
    bathrooms: [1, [Validators.required, Validators.min(0)]],
    dailyPrice: [0, [Validators.required, Validators.min(0)]],
    rentable: [true],
    isEntireVilla: [false],
  });

  private get villaId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.load();
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
