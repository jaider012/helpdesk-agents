import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { TicketSummary } from './contracts';

/** Prefix of the api routes; the dev server proxies `/api/*` to the NestJS api (`proxy.conf.json`). */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});

/** HTTP client of the api endpoints in specs/design.md §12.1. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listTickets(): Observable<TicketSummary[]> {
    return this.http.get<TicketSummary[]>(`${this.baseUrl}/tickets`);
  }
}
