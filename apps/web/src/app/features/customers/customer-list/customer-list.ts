import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { Customer } from '../../../core/models/customer.model';
import { CustomersService } from '../customers.service';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NzButtonModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzTableModule,
  ],
  templateUrl: './customer-list.html',
  styleUrl: './customer-list.scss',
})
export class CustomerList implements OnInit {
  private readonly customersService = inject(CustomersService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);

  protected readonly customers = signal<Customer[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly searchTerm = signal('');

  protected readonly modalVisible = signal(false);
  protected readonly modalSaving = signal(false);
  protected editingCustomer: Customer | null = null;

  protected readonly form = this.formBuilder.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phone: [''],
    email: ['', Validators.email],
    identityNumber: [''],
    passportNumber: [''],
    notes: [''],
  });

  ngOnInit(): void {
    this.loadPage();
  }

  async loadPage(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.customersService.list({
        page: this.pageIndex(),
        limit: this.pageSize(),
        search: this.searchTerm() || undefined,
      });
      this.customers.set(result.data);
      this.total.set(result.total);
    } finally {
      this.loading.set(false);
    }
  }

  goToDetail(customer: Customer): void {
    this.router.navigate(['/customers', customer.id]);
  }

  onSearch(): void {
    this.pageIndex.set(1);
    this.loadPage();
  }

  onPageIndexChange(index: number): void {
    this.pageIndex.set(index);
    this.loadPage();
  }

  openCreateModal(): void {
    this.editingCustomer = null;
    this.form.reset({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      identityNumber: '',
      passportNumber: '',
      notes: '',
    });
    this.modalVisible.set(true);
  }

  openEditModal(customer: Customer): void {
    this.editingCustomer = customer;
    this.form.reset({
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      identityNumber: customer.identityNumber ?? '',
      passportNumber: customer.passportNumber ?? '',
      notes: customer.notes ?? '',
    });
    this.modalVisible.set(true);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    this.modalSaving.set(true);
    const value = this.form.getRawValue();
    const input = {
      firstName: value.firstName,
      lastName: value.lastName,
      phone: value.phone || undefined,
      email: value.email || undefined,
      identityNumber: value.identityNumber || undefined,
      passportNumber: value.passportNumber || undefined,
      notes: value.notes || undefined,
    };

    try {
      if (this.editingCustomer) {
        await this.customersService.update(this.editingCustomer.id, input);
        this.message.success('Müşteri güncellendi');
      } else {
        await this.customersService.create(input);
        this.message.success('Müşteri oluşturuldu');
      }

      this.modalVisible.set(false);
      await this.loadPage();
    } catch (error) {
      this.message.error(this.extractErrorMessage(error));
    } finally {
      this.modalSaving.set(false);
    }
  }

  async remove(customer: Customer): Promise<void> {
    try {
      await this.customersService.remove(customer.id);
      this.message.success('Müşteri silindi');
      await this.loadPage();
    } catch {
      this.message.error('Müşteri silinemedi');
    }
  }

  private extractErrorMessage(error: unknown): string {
    const httpError = error as { error?: { message?: string | string[] } };
    const message = httpError?.error?.message;
    if (Array.isArray(message)) return message.join(', ');
    return message ?? 'İşlem başarısız oldu';
  }
}
