import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Severity } from '../core/contracts';

/** Filled bars per severity, as Linear draws priority: P2 three, P3 two, P4 one. */
const BARS: Record<Severity, number> = { P1: 3, P2: 3, P3: 2, P4: 1 };

/** Severity glyph in the style of Linear's priority. Decorative: the caller renders the text. */
@Component({
  selector: 'app-severity-icon',
  template: `
    <svg viewBox="0 0 16 16" aria-hidden="true" [attr.data-severity]="severity() ?? 'none'">
      @if (severity() === 'P1') {
        <rect x="1.5" y="1.5" width="13" height="13" rx="3.5" class="fill" />
        <path d="M8 4.6v4.1" class="mark" />
        <circle cx="8" cy="11.1" r="0.95" class="dot" />
      } @else if (severity()) {
        <rect x="1.5" y="9" width="3" height="5" rx="1" class="bar" [class.on]="bars() >= 1" />
        <rect x="6.5" y="6" width="3" height="8" rx="1" class="bar" [class.on]="bars() >= 2" />
        <rect x="11.5" y="3" width="3" height="11" rx="1" class="bar" [class.on]="bars() >= 3" />
      } @else {
        <path d="M2.5 8h2M7 8h2M11.5 8h2" class="dash" />
      }
    </svg>
  `,
  host: { class: 'severity-icon' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeverityIcon {
  readonly severity = input<Severity>();

  protected readonly bars = computed(() => {
    const severity = this.severity();
    return severity ? BARS[severity] : 0;
  });
}
