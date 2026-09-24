import { formatDate } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TicketSummary } from '../core/contracts';
import { Inbox } from './inbox';

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
  let fixture: ComponentFixture<Inbox>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Inbox);
    TestBed.tick();
  });

  afterEach(() => http.verify());

  function rows(): string[][] {
    const element = fixture.nativeElement as HTMLElement;
    return [...element.querySelectorAll('tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim() ?? ''),
    );
  }

  it('lists every ticket with ticketId, category, severity, status and SLA', async () => {
    http.expectOne({ method: 'GET', url: '/api/tickets' }).flush(TICKETS);
    await fixture.whenStable();

    const dueAt = formatDate('2026-09-24T10:15:00.000Z', 'dd/MM/yyyy HH:mm', 'en-US');
    expect(rows()).toEqual([
      ['TCK-20260923-101500-a1b', 'Infraestructura y software', 'P3', 'Resuelto', dueAt],
      ['TCK-20260923-102000-c2d', 'Pendiente', 'Pendiente', 'Nuevo', 'Pendiente'],
    ]);
  });

  it('shows a loading message until the list arrives', async () => {
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cargando tickets…');

    http.expectOne('/api/tickets').flush([]);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No hay tickets todavía.');
  });

  it('shows an error message when the list cannot be loaded', async () => {
    http
      .expectOne('/api/tickets')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Internal Server Error' });
    await fixture.whenStable();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No se pudo cargar la bandeja');
    expect(rows()).toEqual([]);
  });
});
