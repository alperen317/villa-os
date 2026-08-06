import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { ConfigurableRole, PermissionRow, PermissionUpdate } from '../../../core/models/permission.model';
import { PermissionsStore } from '../permissions.store';

const ROLE_COLUMNS: { role: ConfigurableRole; label: string }[] = [
  { role: 'Operations', label: 'Operasyon' },
  { role: 'Accounting', label: 'Muhasebe' },
  { role: 'Housekeeping', label: 'Temizlik' },
];

@Component({
  selector: 'app-permissions-tab',
  standalone: true,
  imports: [NzAlertModule, NzButtonModule, NzCheckboxModule, NzTableModule],
  templateUrl: './permissions-tab.html',
  styleUrl: './permissions-tab.scss',
})
export class PermissionsTab implements OnInit {
  protected readonly store = inject(PermissionsStore);
  private readonly message = inject(NzMessageService);

  protected readonly roleColumns = ROLE_COLUMNS;
  protected readonly saving = signal(false);
  protected readonly rows = signal<PermissionRow[]>([]);

  protected readonly dirty = computed(
    () => JSON.stringify(this.rows()) !== JSON.stringify(this.store.rows()),
  );

  async ngOnInit(): Promise<void> {
    await this.store.ensureLoaded();
    this.resetFromStore();
  }

  private resetFromStore(): void {
    this.rows.set(this.store.rows().map((row) => ({ ...row, values: { ...row.values } })));
  }

  isFirstOfModule(row: PermissionRow, index: number): boolean {
    return index === 0 || this.rows()[index - 1].module !== row.module;
  }

  toggle(row: PermissionRow, role: ConfigurableRole): void {
    this.rows.update((rows) =>
      rows.map((current) =>
        current.key === row.key
          ? { ...current, values: { ...current.values, [role]: !current.values[role] } }
          : current,
      ),
    );
  }

  async save(): Promise<void> {
    const original = this.store.rows();
    const updates: PermissionUpdate[] = [];

    for (const row of this.rows()) {
      const originalRow = original.find((candidate) => candidate.key === row.key);
      for (const { role } of ROLE_COLUMNS) {
        if (originalRow?.values[role] !== row.values[role]) {
          updates.push({ role, permissionKey: row.key, allowed: row.values[role] });
        }
      }
    }

    if (updates.length === 0) {
      return;
    }

    this.saving.set(true);
    try {
      await this.store.save(updates);
      this.resetFromStore();
      this.message.success('İzinler kaydedildi');
    } catch {
      this.message.error('İzinler kaydedilemedi');
    } finally {
      this.saving.set(false);
    }
  }
}
