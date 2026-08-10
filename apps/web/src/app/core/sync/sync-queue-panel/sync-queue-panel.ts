import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { SyncOperationType, SyncOutboxItem } from '../sync-queue.model';
import { SyncQueueStore } from '../sync-queue.store';

const OPERATION_LABELS: Record<SyncOperationType, string> = {
  'create-reservation': 'Yeni Rezervasyon',
  'update-reservation': 'Düzenleme',
  'cancel-reservation': 'İptal',
};

@Component({
  selector: 'app-sync-queue-panel',
  standalone: true,
  imports: [
    DatePipe,
    NzBadgeModule,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzIconModule,
    NzTagModule,
  ],
  templateUrl: './sync-queue-panel.html',
  styleUrl: './sync-queue-panel.scss',
})
export class SyncQueuePanel {
  protected readonly store = inject(SyncQueueStore);
  private readonly router = inject(Router);
  protected readonly operationLabels = OPERATION_LABELS;
  protected readonly visible = signal(false);

  open(): void {
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  retryAll(): void {
    void this.store.replay();
  }

  discard(item: SyncOutboxItem): void {
    void this.store.discard(item.id);
  }

  async resolve(item: SyncOutboxItem): Promise<void> {
    await this.store.requestResolve(item);
    this.close();
    await this.router.navigateByUrl('/reservations');
  }
}
