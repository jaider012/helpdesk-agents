import { Routes } from '@angular/router';
import { Inbox } from './inbox/inbox';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tickets' },
  { path: 'tickets', component: Inbox, title: 'Bandeja de tickets' },
];
