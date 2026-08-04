import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { Villa } from '../../../core/models/villa.model';
import { VillasService } from '../villas.service';

@Component({
  selector: 'app-villa-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterModule,
    NzButtonModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
  ],
  templateUrl: './villa-list.html',
  styleUrl: './villa-list.scss',
})
export class VillaList implements OnInit {
  private readonly villasService = inject(VillasService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly message = inject(NzMessageService);

  protected readonly villas = signal<Villa[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly modalVisible = signal(false);
  protected readonly modalSaving = signal(false);
  protected editingVilla: Villa | null = null;

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    address: [''],
  });

  ngOnInit(): void {
    this.loadPage();
  }

  async loadPage(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.villasService.list({
        page: this.pageIndex(),
        limit: this.pageSize(),
      });
      this.villas.set(result.data);
      this.total.set(result.total);
    } finally {
      this.loading.set(false);
    }
  }

  onPageIndexChange(index: number): void {
    this.pageIndex.set(index);
    this.loadPage();
  }

  openCreateModal(): void {
    this.editingVilla = null;
    this.form.reset({ name: '', description: '', address: '' });
    this.modalVisible.set(true);
  }

  openEditModal(villa: Villa): void {
    this.editingVilla = villa;
    this.form.reset({
      name: villa.name,
      description: villa.description ?? '',
      address: villa.address ?? '',
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
      if (this.editingVilla) {
        await this.villasService.update(this.editingVilla.id, value);
        this.message.success('Villa güncellendi');
      } else {
        await this.villasService.create(value);
        this.message.success('Villa oluşturuldu');
      }

      this.modalVisible.set(false);
      await this.loadPage();
    } catch {
      this.message.error('İşlem başarısız oldu');
    } finally {
      this.modalSaving.set(false);
    }
  }

  async toggleStatus(villa: Villa): Promise<void> {
    try {
      if (villa.status === 'Active') {
        await this.villasService.deactivate(villa.id);
      } else {
        await this.villasService.activate(villa.id);
      }
      await this.loadPage();
    } catch {
      this.message.error('Durum değiştirilemedi');
    }
  }

  async remove(villa: Villa): Promise<void> {
    try {
      await this.villasService.remove(villa.id);
      this.message.success('Villa silindi');
      await this.loadPage();
    } catch {
      this.message.error('Villa silinemedi');
    }
  }
}
