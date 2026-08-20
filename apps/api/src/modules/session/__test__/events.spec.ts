import { describe, expect, it } from 'bun:test';
import { createSessionEvents } from '../events';

describe('session events', () => {
  it('ends open subscriptions when the bus closes', async () => {
    const events = createSessionEvents();
    const request = new AbortController();
    const received: string[] = [];

    const consumed = (async () => {
      for await (const event of events.subscribe('session-1', request.signal)) {
        received.push(event.type);
      }
    })();

    events.publish('session-1', {
      type: 'claims-updated',
      at: new Date().toISOString(),
    });
    await Bun.sleep(10);

    events.close();

    await Promise.race([
      consumed,
      Bun.sleep(1000).then(() => {
        throw new Error('subscription outlived the bus');
      }),
    ]);

    expect(received).toEqual(['claims-updated']);
  });
});
