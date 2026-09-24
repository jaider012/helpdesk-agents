import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { TicketSummary } from '../core/contracts';
import {
  CATEGORY_LABELS,
  PENDING_LABEL,
  SEVERITY_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
} from '../core/labels';
import { SeverityIcon } from '../shared/severity-icon';
import { StatusIcon } from '../shared/status-icon';

/** Within a group, the most severe tickets first; unclassified ones last. */
function bySeverity(a: TicketSummary, b: TicketSummary): number {
  const rank = (ticket: TicketSummary) => (ticket.severity ? Number(ticket.severity[1]) : 5);
  return rank(a) - rank(b);
}

@Component({
  selector: 'app-inbox',
  imports: [DatePipe, RouterLink, SeverityIcon, StatusIcon],
  templateUrl: './inbox.html',
  styleUrl: './inbox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inbox {
  private readonly api = inject(ApiService);

  protected readonly tickets = rxResource({
    stream: () => this.api.listTickets(),
    defaultValue: [],
  });
  /** The tickets grouped by status, in lifecycle order; empty groups are left out. */
  protected readonly groups = computed(() => {
    const tickets = this.tickets.hasValue() ? this.tickets.value() : [];
    return STATUS_ORDER.map((status) => ({
      status,
      tickets: tickets.filter((ticket) => ticket.status === status).sort(bySeverity),
    })).filter((group) => group.tickets.length > 0);
  });

  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly severityLabels = SEVERITY_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly pendingLabel = PENDING_LABEL;
}
