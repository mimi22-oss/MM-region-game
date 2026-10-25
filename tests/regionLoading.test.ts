import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RegionDownloadQueue } from '../src/game/regionLoading.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('region downloads are serial, deduplicated and foreground destinations precede queued prefetches', async () => {
  const jobs = Object.fromEntries(['spawn', 'near', 'far', 'destination'].map(id => [id, deferred<string>()]));
  const started: string[] = [];
  const queue = new RegionDownloadQueue(Object.keys(jobs).map(id => ({
    id, name: id, load: () => { started.push(id); return jobs[id].promise; },
  })));
  queue.request(['spawn', 'near', 'far']);
  queue.request(['spawn', 'near']);
  queue.request(['destination'], true);
  assert.deepEqual(started, ['spawn']);
  assert.equal(queue.getSnapshot().find(item => item.id === 'destination')?.phase, 'queued');
  jobs.spawn.resolve('spawn scene');
  await jobs.spawn.promise;
  assert.deepEqual(started, ['spawn', 'destination']);
  jobs.destination.resolve('destination scene');
  await jobs.destination.promise;
  assert.deepEqual(started, ['spawn', 'destination', 'near']);
  jobs.near.resolve('near scene');
  await jobs.near.promise;
  jobs.far.resolve('far scene');
  await jobs.far.promise;
  assert.deepEqual(started, ['spawn', 'destination', 'near', 'far']);
  assert.ok(queue.getSnapshot().every(item => item.phase === 'downloaded'));
  queue.request(['spawn', 'near', 'far', 'destination']);
  assert.equal(started.length, 4, 'completed imports are reused');
});

test('failed downloads remain visible without automatic retry loops and do not stop the rest of the queue', async () => {
  const first = deferred<string>();
  let attempts = 0;
  const queue = new RegionDownloadQueue([
    { id: 'a', name: 'မြို့သာ', load: () => { attempts++; return first.promise; } },
    { id: 'b', name: 'သာစည်', load: async () => 'b scene' },
  ]);
  queue.request(['a', 'b']);
  first.reject(new Error('offline'));
  await first.promise.catch(() => {});
  await Promise.resolve();
  assert.equal(queue.getSnapshot()[0].phase, 'error');
  assert.equal(queue.getSnapshot()[1].phase, 'downloaded');
  queue.request(['a'], true);
  assert.equal(attempts, 1, 'streaming does not create an automatic retry loop');
});

test('snapshots stay stable for repeated requests and subscribers can unsubscribe', async () => {
  const job = deferred<string>();
  const queue = new RegionDownloadQueue([{ id: 'a', name: 'မြို့သာ', load: () => job.promise }]);
  let updates = 0;
  const unsubscribe = queue.subscribe(() => { updates++; });
  const initial = queue.getSnapshot();
  queue.request(['unknown']);
  assert.equal(queue.getSnapshot(), initial);
  queue.request(['a']);
  const downloading = queue.getSnapshot();
  queue.request(['a', 'a']);
  assert.equal(queue.getSnapshot(), downloading);
  assert.equal(updates, 2);
  unsubscribe();
  job.resolve('scene');
  await job.promise;
  assert.equal(updates, 2);
});
