import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { CATEGORY_LABELS, PENDING_LABEL, STATUS_LABELS } from '../core/labels';
import { AuditView } from './audit/audit-view';
import { Timeline } from './timeline/timeline';

@Component({
  selector: 'app-ticket-detail',
  imports: [AuditView, DatePipe, RouterLink, Timeline],
  templateUrl: './ticket-detail.html',
  styleUrl: './ticket-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketDetail {
  private readonly api = inject(ApiService);

  /** Route parameter `:id` (component input binding). */
  readonly id = input.required<string>();

  protected readonly ticket = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.getTicket(params),
  });
  protected readonly audit = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.getAudit(params),
    defaultValue: [],
  });
  protected readonly tab = signal<'timeline' | 'audit'>('timeline');
  protected readonly notFound = computed(() => {
    const error = this.ticket.error();
    return error instanceof HttpErrorResponse && error.status === 404;
  });

  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly pendingLabel = PENDING_LABEL;
}
