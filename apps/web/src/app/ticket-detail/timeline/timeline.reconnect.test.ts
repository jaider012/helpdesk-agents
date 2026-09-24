import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsService, TicketEvent } from '../../core/events.service';
import { FakeEventSource } from '../../../testing/fake-event-source';
import { runningAudit, TICKET, TICKET_ID } from '../../../testing/fixtures';
import { routes } from '../../app.routes';

const EVENTS_URL = `/api/tickets/${TICKET_ID}/events`;

describe('SSE reconnection (REQ-WEB-05)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    // Only the timers of the retry (RxJS schedules them with setInterval) are faked; Angular keeps
    // its real setTimeout to render.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(HttpTestingController).verify();
  });

  function sources(): FakeEventSource[] {
    return FakeEventSource.instances;
  }

  it('retries the connection every 5 s while it keeps dropping', () => {
    const received: TicketEvent[] = [];
    const subscription = TestBed.inject(EventsService)
      .ticketEvents(TICKET_ID)
      .subscribe((event) => received.push(event));

    sources()[0].fail();
    expect(sources()[0].readyState).toBe(FakeEventSource.CLOSED);
    vi.advanceTimersByTime(4999);
    expect(sources()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sources()).toHaveLength(2);

    sources()[1].fail();
    vi.advanceTimersByTime(4999);
    expect(sources()).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sources().map((source) => source.url)).toEqual([EVENTS_URL, EVENTS_URL, EVENTS_URL]);

    const [first] = runningAudit();
    sources()[2].emit('audit', first);
    expect(received).toEqual([{ type: 'audit', entry: first }]);
    subscription.unsubscribe();
  });

  it('stops retrying after the run ends or when nobody listens', () => {
    const events = TestBed.inject(EventsService);
    events.ticketEvents(TICKET_ID).subscribe();
    sources()[0].emit('done', { status: 'RESOLVED' });
    sources()[0].fail();

    const subscription = events.ticketEvents(TICKET_ID).subscribe();
    sources()[1].fail();
    subscription.unsubscribe();
    vi.advanceTimersByTime(20_000);

    expect(sources()).toHaveLength(2);
    expect(sources().every((source) => source.readyState === FakeEventSource.CLOSED)).toBe(true);
  });

  it('keeps the timeline live after the connection comes back', async () => {
    const http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create(`/tickets/${TICKET_ID}`);
    http.expectOne(`/api/tickets/${TICKET_ID}`).flush({ ...TICKET, status: 'NEW' });
    http.expectOne(`/api/tickets/${TICKET_ID}/audit`).flush(runningAudit().slice(0, 5));
    await harness.fixture.whenStable();

    sources()[0].fail();
    vi.advanceTimersByTime(5000);
    expect(sources()).toHaveLength(2);
    // The new connection may repeat what the page already has: the timeline shows it once.
    for (const written of runningAudit()) {
      sources()[1].emit('audit', written);
    }
    await harness.fixture.whenStable();

    const page = harness.routeNativeElement as HTMLElement;
    expect(page.querySelectorAll('.timeline .item')).toHaveLength(8);
  });
});
