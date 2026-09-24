import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TICKET, TICKET_ID } from '../../testing/fixtures';
import { routes } from '../app.routes';

// Synthetic text of an end user; the api redacts it before the graph runs.
const TEXT = 'No puedo conectarme a la VPN desde casa. Mi correo es ana.perez@example.com';
const RUN_URL = '/api/prompts/triage-ticket/run';

describe('new-ticket form (REQ-WEB-07)', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/tickets/new');
  });

  afterEach(() => http.verify());

  function page(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  async function fill(text: string, channel: string): Promise<void> {
    const textarea = page().querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = text;
    textarea.dispatchEvent(new Event('input'));
    const select = page().querySelector('select') as HTMLSelectElement;
    select.value = channel;
    // A browser fires both events when the operator picks an option.
    select.dispatchEvent(new Event('input'));
    select.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();
  }

  function submit(): void {
    (page().querySelector('button[type="submit"]') as HTMLButtonElement).click();
  }

  it('sends the text and the channel to POST /prompts/triage-ticket/run', async () => {
    await fill(`  ${TEXT}  `, 'chat');
    const navigated = firstValueFrom(
      TestBed.inject(Router).events.pipe(filter((event) => event instanceof NavigationEnd)),
    );
    submit();

    const run = http.expectOne({ method: 'POST', url: RUN_URL });
    expect(run.request.body).toEqual({ variables: { ticket: TEXT, channel: 'chat' } });
    run.flush({ ticketId: TICKET_ID }, { status: 202, statusText: 'Accepted' });
    await navigated;

    // The operator lands on the new ticket to follow its run.
    expect(TestBed.inject(Location).path()).toBe(`/tickets/${TICKET_ID}`);
    TestBed.tick();
    http.expectOne(`/api/tickets/${TICKET_ID}`).flush(TICKET);
    http.expectOne(`/api/tickets/${TICKET_ID}/audit`).flush([]);
  });

  it('does not send an empty description', async () => {
    await fill('   ', 'email');
    submit();
    await harness.fixture.whenStable();

    http.expectNone(RUN_URL);
    expect(page().querySelector('.error')?.textContent).toContain('Describe el problema.');
  });

  it('keeps the text and tells the operator when the api rejects the ticket', async () => {
    await fill(TEXT, 'phone');
    submit();
    http
      .expectOne(RUN_URL)
      .flush({ message: 'boom' }, { status: 500, statusText: 'Internal Server Error' });
    await harness.fixture.whenStable();

    expect(page().querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudo crear el ticket',
    );
    expect((page().querySelector('textarea') as HTMLTextAreaElement).value).toBe(TEXT);
    expect(TestBed.inject(Location).path()).toBe('/tickets/new');
  });
});
