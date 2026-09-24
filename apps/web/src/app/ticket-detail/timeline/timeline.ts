import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AuditEntry } from '../../core/contracts';
import { StatusIcon } from '../../shared/status-icon';
import { buildTimeline, formatDuration, TimelineKind } from './build-timeline';

@Component({
  selector: 'app-timeline',
  imports: [DatePipe, StatusIcon],
  templateUrl: './timeline.html',
  styleUrl: './timeline.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Timeline {
  readonly entries = input.required<readonly AuditEntry[]>();

  protected readonly items = computed(() => buildTimeline(this.entries()));
  protected readonly formatDuration = formatDuration;
  protected readonly kindLabels: Record<TimelineKind, string> = {
    node: 'Paso',
    handoff: 'Derivación',
    transition: 'Cambio de estado',
    tool: 'Comprobación',
  };
}
