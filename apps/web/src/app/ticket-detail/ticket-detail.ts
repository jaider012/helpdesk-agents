import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { filter, scan, startWith, tap } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuditEntry } from '../core/contracts';
import { EventsService } from '../core/events.service';
import {
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  PENDING_LABEL,
  SEVERITY_LABELS,
  STATUS_LABELS,
} from '../core/labels';
import { SeverityIcon } from '../shared/severity-icon';
import { StatusIcon } from '../shared/status-icon';
import { AuditView } from './audit/audit-view';
import { mergeAudit } from './merge-audit';
import { redactionParts } from './redaction';
import { subjectOf } from './subject';
import { Timeline } from './timeline/timeline';

@Component({
  selector: 'app-ticket-detail',
  imports: [AuditView, DatePipe, RouterLink, SeverityIcon, StatusIcon, Timeline],
  templateUrl: './ticket-detail.html',
  styleUrl: './ticket-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketDetail {
  private readonly api = inject(ApiService);
  private readonly events = inject(EventsService);

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
  protected readonly notFound = computed(() => {
    const error = this.ticket.error();
    return error instanceof HttpErrorResponse && error.status === 404;
  });

  /**
   * Audit entries received over SSE while the detail is open (REQ-WEB-04). The stream opens with
   * the page, in parallel with the GETs, and stops when the run ends or the ticket does not exist.
   */
  private readonly live = rxResource({
    params: () => (this.notFound() ? undefined : this.id()),
    stream: ({ params }) =>
      this.events.ticketEvents(params).pipe(
        tap((event) => {
          // The run ended: reload the ticket to show its final status and fields.
          if (event.type === 'done') {
            this.ticket.reload();
          }
        }),
        filter((event) => event.type === 'audit'),
        scan((entries, event) => [...entries, event.entry], [] as AuditEntry[]),
        startWith([] as AuditEntry[]),
      ),
    defaultValue: [],
  });
  /** The audit log shown by both tabs: the GET plus the live entries, in write order. */
  protected readonly entries = computed(() =>
    mergeAudit(this.audit.hasValue() ? this.audit.value() : [], this.live.value()),
  );

  /** Title of the page: the first sentence of the redacted text. */
  protected readonly subject = computed(() =>
    this.ticket.hasValue() ? subjectOf(this.ticket.value().redactedText) : '',
  );
  /** The redacted text split around its placeholders, which the view marks as hidden data. */
  protected readonly textParts = computed(() =>
    this.ticket.hasValue() ? redactionParts(this.ticket.value().redactedText) : [],
  );

  protected readonly tab = signal<'timeline' | 'audit'>('timeline');
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly channelLabels = CHANNEL_LABELS;
  protected readonly severityLabels = SEVERITY_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly pendingLabel = PENDING_LABEL;
}
