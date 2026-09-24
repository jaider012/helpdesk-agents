import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runningAudit, TICKET, TICKET_ID } from '../../../testing/fixtures';
import { routes } from '../../app.routes';

describe('audit view (REQ-WEB-03)', () => {
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

  async function openAuditTab(): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create(`/tickets/${TICKET_ID}`);
    http.expectOne(`/api/tickets/${TICKET_ID}`).flush(TICKET);
    http.expectOne(`/api/tickets/${TICKET_ID}/audit`).flush(runningAudit());
    await harness.fixture.whenStable();

    const page = harness.routeNativeElement as HTMLElement;
    const tab = [...page.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (button) => button.textContent?.trim() === 'Bitácora',
    );
    tab?.click();
    await harness.fixture.whenStable();
    return page;
  }

  function column(page: HTMLElement, index: number): string[] {
    return [...page.querySelectorAll('.audit tbody tr')].map(
      (row) => row.querySelectorAll('td')[index]?.textContent?.trim() ?? '',
    );
  }

  it('lists every audit entry in write order', async () => {
    const page = await openAuditTab();
    const written = runningAudit();

    expect(page.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()).toBe(
      'Bitácora',
    );
    expect(column(page, 0)).toEqual(written.map((entry) => String(entry.seq)));
    expect(page.querySelectorAll('.audit .code').length).toBe(written.length);
    expect([...page.querySelectorAll('.audit .code')].map((code) => code.textContent)).toEqual(
      written.map((entry) => entry.decision),
    );
  });

  it('shows the actor, decision, reason, states and data of each entry', async () => {
    const page = await openAuditTab();
    const rows = [...page.querySelectorAll('.audit tbody tr')].map((row) =>
      [...row.querySelectorAll('td')]
        .slice(2)
        .map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim()),
    );

    expect(rows[2]).toEqual([
      'Protección de datos',
      'Datos personales ocultados redacted',
      'pii_found',
      '',
      'email: 1',
    ]);
    expect(rows[7]).toEqual([
      'Clasificación',
      'Cambio de estado transition',
      'classified',
      'NEW → TRIAGED',
      '',
    ]);
  });
});
