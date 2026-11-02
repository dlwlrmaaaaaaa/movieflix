import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CallConnectionLifecycle } from '../../mobile/src/services/callConnectionLifecycle';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test('repeated connection clicks share the pending operation', async () => {
  const lifecycle = new CallConnectionLifecycle();
  const connect = deferred();
  let attempts = 0;
  const first = lifecycle.run('TF-AB23', async () => { attempts++; await connect.promise; });
  const second = lifecycle.run('TF-AB23', async () => { attempts++; });
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(attempts, 1);
  connect.resolve();
  await Promise.all([first, second]);
});

test('leaving invalidates callbacks immediately but waits before closing the peer', async () => {
  const lifecycle = new CallConnectionLifecycle();
  const connect = deferred();
  const events: string[] = [];
  let current!: () => boolean;
  const joining = lifecycle.run('TF-AB23', async (isCurrent) => {
    current = isCurrent;
    events.push('offer started');
    await connect.promise;
    events.push('offer settled');
    if (isCurrent()) events.push('connected UI');
  });
  await Promise.resolve();
  const leaving = lifecycle.stop(async () => { events.push('peer closed'); });
  assert.equal(current(), false);
  assert.deepEqual(events, ['offer started']);
  connect.resolve();
  await Promise.all([joining, leaving]);
  assert.deepEqual(events, ['offer started', 'offer settled', 'peer closed']);
});

test('a reconnect cannot race the previous disconnect', async () => {
  const lifecycle = new CallConnectionLifecycle();
  const cleanup = deferred();
  const cleanupStarted = deferred();
  const events: string[] = [];
  const leaving = lifecycle.stop(async () => { events.push('disconnecting'); cleanupStarted.resolve(); await cleanup.promise; events.push('disconnected'); });
  const joining = lifecycle.run('TF-CD45', async () => { events.push('new peer'); });
  await cleanupStarted.promise;
  assert.deepEqual(events, ['disconnecting']);
  cleanup.resolve();
  await Promise.all([leaving, joining]);
  assert.deepEqual(events, ['disconnecting', 'disconnected', 'new peer']);
});

test('a failed connection does not block a fresh retry', async () => {
  const lifecycle = new CallConnectionLifecycle();
  await assert.rejects(lifecycle.run('TF-AB23', async () => { throw new Error('signal failed'); }), /signal failed/);
  let retried = false;
  await lifecycle.run('TF-AB23', async (isCurrent) => { retried = isCurrent(); });
  assert.equal(retried, true);
});

test('duplicate leave calls close a peer once', async () => {
  const lifecycle = new CallConnectionLifecycle();
  let closes = 0;
  const first = lifecycle.stop(async () => { closes++; });
  const second = lifecycle.stop(async () => { closes++; });
  assert.equal(first, second);
  await Promise.all([first, second]);
  assert.equal(closes, 1);
});

test('another room cannot reuse an in-flight connection', async () => {
  const lifecycle = new CallConnectionLifecycle();
  const connect = deferred();
  const joining = lifecycle.run('TF-AB23', async () => connect.promise);
  await assert.rejects(lifecycle.run('TF-CD45', async () => undefined), /Leave the current call/);
  connect.resolve();
  await joining;
});

test('later publications keep the current room callbacks valid until leave', async () => {
  const lifecycle = new CallConnectionLifecycle();
  let current!: () => boolean;
  await lifecycle.run('TF-AB23', async (isCurrent) => { current = isCurrent; });
  await lifecycle.run('TF-AB23', async () => undefined);
  assert.equal(current(), true);
  await lifecycle.stop(async () => undefined);
  assert.equal(current(), false);
});
