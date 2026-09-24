import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeEventSource } from '../../../testing/fake-event-source';
import { entry, runningAudit, TICKET, TICKET_ID } from '../../../testing/fixtures';
import { routes } from '../../app.routes';

describe('live timeline over SSE (REQ-WEB-04)', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

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

  /** Opens the detail while the run is in its first steps: the GET only has the first 5 entries. */
  async function openRunningTicket(): Promise<HTMLElement> {
    harness = await RouterTestingHarness.create(`/tickets/${TICKET_ID}`);
    http.expectOne(`/api/tickets/${TICKET_ID}`).flush({ ...TICKET, status: 'NEW' });
    http.expectOne(`/api/tickets/${TICKET_ID}/audit`).flush(runningAudit().slice(0, 5));
    await harness.fixture.whenStable();
    return harness.routeNativeElement as HTMLElement;
  }

  function timeline(page: HTMLElement): string[] {
    return [...page.querySelectorAll('.timeline .item')].map((item) =>
      ['.kind', '.title', '.duration']
        .map((selector) => item.querySelector(selector)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' | '),
    );
  }

  it('opens the event stream of the ticket', async () => {
    await openRunningTicket();

    expect(FakeEventSource.instances.map((source) => source.url)).toEqual([
      `/api/tickets/${TICKET_ID}/events`,
    ]);
  });

  it('appends the entries received over SSE to the timeline without a page reload', async () => {
    const page = await openRunningTicket();
    expect(timeline(page)).toEqual([
      'Paso | Protección de datos | Duración: 40 ms',
      'Derivación | Protección de datos → Clasificación',
    ]);

    const [stream] = FakeEventSource.instances;
    // The stream repeats seq 4 and 5, which the GET already returned: they are shown once.
    for (const written of runningAudit().slice(3)) {
      stream.emit('audit', written);
    }
    await harness.fixture.whenStable();

    expect(timeline(page)).toEqual([
      'Paso | Protección de datos | Duración: 40 ms',
      'Derivación | Protección de datos → Clasificación',
      'Paso | Clasificación | Duración: 1,5 s',
      'Cambio de estado | Nuevo → Clasificado',
      'Derivación | Clasificación → Diagnóstico',
      'Paso | Diagnóstico | En curso',
      'Cambio de estado | Clasificado → En curso',
      'Comprobación | Diagnóstico | Duración: 14 ms',
    ]);
    http.expectNone(`/api/tickets/${TICKET_ID}/audit`);
  });

  it('shows the live entries in the audit tab too', async () => {
    const page = await openRunningTicket();
    const [stream] = FakeEventSource.instances;
    for (const written of runningAudit().slice(5)) {
      stream.emit('audit', written);
    }
    (page.querySelector('#tab-audit') as HTMLButtonElement).click();
    await harness.fixture.whenStable();

    expect([...page.querySelectorAll('.audit .seq')].map((cell) => cell.textContent)).toEqual(
      runningAudit().map((written) => String(written.seq)),
    );
  });

  it('refreshes the ticket and closes the stream when the run ends', async () => {
    const page = await openRunningTicket();
    const [stream] = FakeEventSource.instances;
    for (const written of runningAudit().slice(5)) {
      stream.emit('audit', written);
    }
    stream.emit(
      'audit',
      entry({
        ts: '2026-09-23T10:15:02.100Z',
        agent: 'diagnostics',
        decision: 'transition',
        reason: 'resolved',
        from: 'IN_PROGRESS',
        to: 'RESOLVED',
      }),
    );
    stream.emit(
      'audit',
      entry({
        ts: '2026-09-23T10:15:02.560Z',
        agent: 'diagnostics',
        decision: 'node_finished',
        reason: 'done',
      }),
    );
    stream.emit('done', { status: 'RESOLVED' });
    TestBed.tick();

    http.expectOne(`/api/tickets/${TICKET_ID}`).flush({ ...TICKET, status: 'RESOLVED' });
    await harness.fixture.whenStable();

    expect(page.querySelector('.summary dd')?.textContent?.trim()).toBe('Resuelto');
    expect(timeline(page)).toContain('Paso | Diagnóstico | Duración: 1,0 s');
    expect(timeline(page).at(-1)).toBe('Cambio de estado | En curso → Resuelto');
    expect(stream.readyState).toBe(FakeEventSource.CLOSED);
  });
});
