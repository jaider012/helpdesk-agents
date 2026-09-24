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
  {
    ticketId: 'TCK-20260923-110500-e3f',
    category: 'provisioning',
    severity: 'P3',
    status: 'ESCALATED',
    slaDueAt: '2026-09-24T11:05:00.000Z',
  },
  {
    ticketId: 'TCK-20260923-091200-k7m',
    category: 'infra',
    severity: 'P1',
    status: 'ESCALATED',
    slaDueAt: '2026-09-23T13:12:00.000Z',
  },
];

const due = (iso: string) => formatDate(iso, 'dd/MM HH:mm', 'en-US');

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

  /** Cells of each ticket row: severity, ticketId, status, category and SLA. */
  function rows(): string[][] {
    return [...page().querySelectorAll('tbody tr.row')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim() ?? ''),
    );
  }

  it('lists every ticket with ticketId, category, severity, status and SLA', async () => {
    http.expectOne({ method: 'GET', url: '/api/tickets' }).flush(TICKETS);
    await harness.fixture.whenStable();

    expect(rows()).toEqual([
      ['Pendiente', 'TCK-20260923-102000-c2d', 'Nuevo', 'Pendiente', 'Pendiente'],
      [
        'P1',
        'TCK-20260923-091200-k7m',
        'Escalado',
        'Infraestructura y software',
        due('2026-09-23T13:12:00.000Z'),
      ],
      [
        'P3',
        'TCK-20260923-110500-e3f',
        'Escalado',
        'Aprovisionamiento y permisos',
        due('2026-09-24T11:05:00.000Z'),
      ],
      [
        'P3',
        'TCK-20260923-101500-a1b',
        'Resuelto',
        'Infraestructura y software',
        due('2026-09-24T10:15:00.000Z'),
      ],
    ]);
  });

  it('groups the tickets by status in lifecycle order, the most severe first', async () => {
    http.expectOne('/api/tickets').flush(TICKETS);
    await harness.fixture.whenStable();

    const groups = [...page().querySelectorAll('tbody tr.group')].map((group) =>
      group.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(groups).toEqual(['Nuevo 1', 'Escalado 2', 'Resuelto 1']);
    expect(page().querySelector('.topbar .count-badge')?.textContent?.trim()).toBe('4');
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
