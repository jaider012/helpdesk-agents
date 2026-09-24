/**
 * Test double of the browser `EventSource` (jsdom has none). Tests drive it: `emit` sends a named
 * server event with a JSON payload and `fail` drops the connection. A closed source stays silent,
 * like the real one.
 */
export class FakeEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  /** Every source created since the last `reset`, in creation order. */
  static instances: FakeEventSource[] = [];

  readyState = FakeEventSource.CONNECTING;

  constructor(readonly url: string) {
    super();
    FakeEventSource.instances.push(this);
  }

  static reset(): void {
    FakeEventSource.instances = [];
  }

  /** Sends a named event as the api does (specs/design.md §12.1): `audit` or `done`. */
  emit(type: 'audit' | 'done', data: unknown): void {
    if (this.readyState !== FakeEventSource.CLOSED) {
      this.readyState = FakeEventSource.OPEN;
      this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
    }
  }

  /** The connection drops: the browser fires `error`. */
  fail(): void {
    if (this.readyState !== FakeEventSource.CLOSED) {
      this.dispatchEvent(new Event('error'));
    }
  }

  close(): void {
    this.readyState = FakeEventSource.CLOSED;
  }
}
