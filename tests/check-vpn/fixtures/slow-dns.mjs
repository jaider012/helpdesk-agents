// Test preload: DNS lookups answer after 60 s, like an unresponsive resolver. The pending timer keeps
// the event loop alive, as a real in-flight lookup does.
import dns from 'node:dns';

dns.promises.lookup = () =>
  new Promise((resolve) =>
    setTimeout(() => resolve([{ address: '127.0.0.1', family: 4 }]), 60_000),
  );
