import { AsyncLocalStorage } from 'node:async_hooks';
import type { FastifyRequest } from 'fastify';

type RequestStore = {
  requestId?: string;
  queryCount: number;
};

const storage = new AsyncLocalStorage<RequestStore>();

export function runWithRequestContext(req: FastifyRequest, next: () => void) {
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
