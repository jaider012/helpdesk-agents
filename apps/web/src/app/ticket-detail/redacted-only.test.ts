import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runningAudit, TICKET, TICKET_ID } from '../../testing/fixtures';
import { routes } from '../app.routes';

// Synthetic original values that the redact node replaced; none of them may reach the page.
const ORIGINAL_VALUES = ['ana.perez@example.com', '+57 300 000 0000', 'clave-de-prueba-123'];

describe('ticket text (REQ-WEB-06)', () => {
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

  it('displays only the redacted text, even if the response carries other text fields', async () => {
    const harness = await RouterTestingHarness.create(`/tickets/${TICKET_ID}`);
    http.expectOne(`/api/tickets/${TICKET_ID}`).flush({
      ...TICKET,
      redactedText: 'Mi correo es [EMAIL], mi teléfono [PHONE] y password: [SECRET].',
      // Not part of the contract: a regression in the api must not make the web show it.
      rawText: `Mi correo es ${ORIGINAL_VALUES[0]}, mi teléfono ${ORIGINAL_VALUES[1]} y password: ${ORIGINAL_VALUES[2]}.`,
    });
    http.expectOne(`/api/tickets/${TICKET_ID}/audit`).flush(runningAudit());
    await harness.fixture.whenStable();

    const page = harness.routeNativeElement as HTMLElement;
    expect(page.querySelector('.ticket-text blockquote')?.textContent).toBe(
      'Mi correo es [EMAIL], mi teléfono [PHONE] y password: [SECRET].',
    );
    for (const value of ORIGINAL_VALUES) {
      expect(page.textContent).not.toContain(value);
    }
  });
});
