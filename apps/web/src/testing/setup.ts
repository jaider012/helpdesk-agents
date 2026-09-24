import { afterEach, beforeEach, vi } from 'vitest';
import { FakeEventSource } from './fake-event-source';

// jsdom has no EventSource and the ticket detail opens a live stream: every test gets the fake.
beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});
