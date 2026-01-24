import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

export function runWithRequestContext(req, next) {
  const store = {
    requestId: req.requestId,
    queryCount: 0,
  };
  return storage.run(store, next);
}

export function incrementQueryCount() {
  const store = storage.getStore();
  if (store) {
    store.queryCount += 1;
  }
}

export function getQueryCount() {
  const store = storage.getStore();
  return store?.queryCount ?? 0;
}
