import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { CATEGORY_LABELS, PENDING_LABEL, STATUS_LABELS } from '../core/labels';

@Component({
  selector: 'app-inbox',
  imports: [DatePipe, RouterLink],
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
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly pendingLabel = PENDING_LABEL;
}
