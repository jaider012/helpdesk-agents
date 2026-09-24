import { DatePipe, KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AuditEntry } from '../../core/contracts';
import { actorLabel, decisionLabel } from '../../core/labels';

/** The audit log of a ticket, in write order (REQ-WEB-03). */
@Component({
  selector: 'app-audit-view',
  imports: [DatePipe, KeyValuePipe],
  templateUrl: './audit-view.html',
  styleUrl: './audit-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditView {
  /** Entries as the api wrote them; the view never reorders them. */
  readonly entries = input.required<readonly AuditEntry[]>();

  protected readonly actorLabel = actorLabel;
  protected readonly decisionLabel = decisionLabel;
  protected readonly keepOrder = () => 0;
}
