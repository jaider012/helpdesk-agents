import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-inbox',
  templateUrl: './inbox.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inbox {}
