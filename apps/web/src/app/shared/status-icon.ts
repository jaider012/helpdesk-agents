import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Status glyph in the style of Linear. Decorative: the caller always renders the status text. */
@Component({
  selector: 'app-status-icon',
  template: `
    <svg viewBox="0 0 16 16" aria-hidden="true" [attr.data-status]="status()">
      @switch (status()) {
        @case ('TRIAGED') {
          <circle cx="8" cy="8" r="6" class="ring" />
        }
        @case ('IN_PROGRESS') {
          <circle cx="8" cy="8" r="6" class="ring" />
          <path d="M8 4.5a3.5 3.5 0 0 1 0 7Z" class="fill" />
        }
        @case ('WAITING_USER') {
          <circle cx="8" cy="8" r="6" class="ring" />
          <rect x="5.9" y="5.4" width="1.4" height="5.2" rx="0.6" class="fill" />
          <rect x="8.7" y="5.4" width="1.4" height="5.2" rx="0.6" class="fill" />
        }
        @case ('RESOLVED') {
          <circle cx="8" cy="8" r="7" class="fill" />
          <path d="M5.1 8.2 7.1 10.2 10.9 6.1" class="mark" />
        }
        @case ('ESCALATED') {
          <circle cx="8" cy="8" r="7" class="fill" />
          <path d="M8 11.2V5.2M5.6 7.5 8 5.1l2.4 2.4" class="mark" />
        }
        @case ('CLOSED') {
          <circle cx="8" cy="8" r="7" class="fill" />
          <path d="M5.1 8.2 7.1 10.2 10.9 6.1" class="mark" />
        }
        @default {
          <circle cx="8" cy="8" r="6" class="ring dashed" />
        }
      }
    </svg>
  `,
  host: { class: 'status-icon' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusIcon {
  readonly status = input<string>();
}
