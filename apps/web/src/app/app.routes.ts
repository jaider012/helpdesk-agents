import { Routes } from '@angular/router';
import { Inbox } from './inbox/inbox';
import { TicketDetail } from './ticket-detail/ticket-detail';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tickets' },
  { path: 'tickets', component: Inbox, title: 'Bandeja de tickets' },
  { path: 'tickets/:id', component: TicketDetail, title: 'Detalle del ticket' },
];
