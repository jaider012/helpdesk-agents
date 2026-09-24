import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runningAudit, TICKET, TICKET_ID } from '../../../testing/fixtures';
import { routes } from '../../app.routes';

describe('ticket timeline (REQ-WEB-02)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function openTicket(): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create(`/tickets/${TICKET_ID}`);
    http.expectOne({ method: 'GET', url: `/api/tickets/${TICKET_ID}` }).flush(TICKET);
    http.expectOne({ method: 'GET', url: `/api/tickets/${TICKET_ID}/audit` }).flush(runningAudit());
    await harness.fixture.whenStable();
    return harness.routeNativeElement as HTMLElement;
  }

  function timelineItems(page: HTMLElement): string[][] {
    return [...page.querySelectorAll('.timeline .item')].map((item) =>
      ['.kind', '.title', '.reason', '.duration'].map(
        (selector) => item.querySelector(selector)?.textContent?.trim() ?? '',
      ),
    );
  }

  it('shows visited nodes, handoffs, decisions and durations in order', async () => {
    const page = await openTicket();

    expect(page.querySelector('h1')?.textContent).toContain(TICKET_ID);
    expect(timelineItems(page)).toEqual([
      ['Paso', 'Protección de datos', '', 'Duración: 40 ms'],
      ['Derivación', 'Protección de datos → Clasificación', 'Motivo: entry_agent', ''],
      ['Paso', 'Clasificación', '', 'Duración: 1,5 s'],
      ['Cambio de estado', 'Nuevo → Clasificado', 'Motivo: classified', ''],
      ['Derivación', 'Clasificación → Diagnóstico', 'Motivo: R-T1', ''],
      ['Paso', 'Diagnóstico', '', 'En curso'],
      ['Cambio de estado', 'Clasificado → En curso', 'Motivo: taken', ''],
      ['Comprobación', 'Diagnóstico', 'Motivo: check-vpn: ok', 'Duración: 14 ms'],
    ]);
  });

  it('opens the detail from the ticket link of the inbox', async () => {
    const harness = await RouterTestingHarness.create('/tickets');
    http.expectOne('/api/tickets').flush([{ ticketId: TICKET_ID, status: 'IN_PROGRESS' }]);
    await harness.fixture.whenStable();

    const navigated = firstValueFrom(
      TestBed.inject(Router).events.pipe(filter((event) => event instanceof NavigationEnd)),
    );
    (harness.routeNativeElement?.querySelector('tbody a') as HTMLAnchorElement).click();
    await navigated;
    TestBed.tick();
    http.expectOne(`/api/tickets/${TICKET_ID}`).flush(TICKET);
    http.expectOne(`/api/tickets/${TICKET_ID}/audit`).flush(runningAudit());
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.querySelectorAll('.timeline .item')).toHaveLength(8);
  });

  it('tells the operator when the ticket does not exist', async () => {
    const harness = await RouterTestingHarness.create('/tickets/TCK-20260923-999999-zzz');
    http
      .expectOne('/api/tickets/TCK-20260923-999999-zzz')
      .flush({ message: 'not found' }, { status: 404, statusText: 'Not Found' });
    http.expectOne('/api/tickets/TCK-20260923-999999-zzz/audit').flush([]);
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.querySelector('[role="alert"]')?.textContent).toContain(
      'No encontramos el ticket TCK-20260923-999999-zzz',
    );
  });
});
