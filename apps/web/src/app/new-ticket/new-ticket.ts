import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, requiredError, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { Channel } from '../core/contracts';

interface NewTicketModel {
  ticket: string;
  channel: Channel;
}

@Component({
  selector: 'app-new-ticket',
  imports: [FormField, FormRoot],
  templateUrl: './new-ticket.html',
  styleUrl: './new-ticket.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewTicket {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly failed = signal(false);
  protected readonly ticketForm = form(
    signal<NewTicketModel>({ ticket: '', channel: 'email' }),
    (path) => {
      validate(path.ticket, ({ value }) =>
        value().trim() ? undefined : requiredError({ message: 'Describe el problema.' }),
      );
    },
    { submission: { action: (fields) => this.send(fields().value()) } },
  );

  /** Starts the triage of the text (REQ-WEB-07) and opens the new ticket to follow its run. */
  private async send({ ticket, channel }: NewTicketModel): Promise<undefined> {
    this.failed.set(false);
    try {
      const { ticketId } = await firstValueFrom(
        this.api.runPrompt('triage-ticket', { ticket: ticket.trim(), channel }),
      );
      await this.router.navigate(['/tickets', ticketId]);
    } catch {
      this.failed.set(true);
    }
    return undefined;
  }
}
