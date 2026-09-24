import { formatDate } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { routes } from '../app.routes';
import { TicketSummary } from '../core/contracts';

const TICKETS: TicketSummary[] = [
  {
    ticketId: 'TCK-20260923-101500-a1b',
    category: 'infra',
    severity: 'P3',
    status: 'RESOLVED',
    slaDueAt: '2026-09-24T10:15:00.000Z',
  },
  { ticketId: 'TCK-20260923-102000-c2d', status: 'NEW' },
];

describe('inbox (REQ-WEB-01)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/tickets');
  });

  afterEach(() => http.verify());

  function page(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function rows(): string[][] {
    return [...page().querySelectorAll('tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim() ?? ''),
    );
  }

  it('lists every ticket with ticketId, category, severity, status and SLA', async () => {
    http.expectOne({ method: 'GET', url: '/api/tickets' }).flush(TICKETS);
    await harness.fixture.whenStable();

    const dueAt = formatDate('2026-09-24T10:15:00.000Z', 'dd/MM/yyyy HH:mm', 'en-US');
    expect(rows()).toEqual([
      ['TCK-20260923-101500-a1b', 'Infraestructura y software', 'P3', 'Resuelto', dueAt],
      ['TCK-20260923-102000-c2d', 'Pendiente', 'Pendiente', 'Nuevo', 'Pendiente'],
    ]);
  });

  it('shows a loading message until the list arrives', async () => {
    expect(page().textContent).toContain('Cargando tickets…');

    http.expectOne('/api/tickets').flush([]);
    await harness.fixture.whenStable();
    expect(page().textContent).toContain('No hay tickets todavía.');
  });

  it('shows an error message when the list cannot be loaded', async () => {
    http
      .expectOne('/api/tickets')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Internal Server Error' });
    await harness.fixture.whenStable();

    expect(page().querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudo cargar la bandeja',
    );
    expect(rows()).toEqual([]);
  });
});
