import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('app smoke (REQ-WEB-08)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('redirects the root path to the inbox view', async () => {
    const harness = await RouterTestingHarness.create('/');

    expect(TestBed.inject(Location).path()).toBe('/tickets');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Bandeja de tickets',
    );
  });
});
