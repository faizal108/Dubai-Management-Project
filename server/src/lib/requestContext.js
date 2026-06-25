import { AsyncLocalStorage } from "node:async_hooks";

// Holds per-request state without prop-drilling. Consumed by Prisma extensions,
// audit logging, and any service that needs the acting user / tenant.
const storage = new AsyncLocalStorage();

export function runWithContext(initial, fn) {
  return storage.run({ ...initial }, fn);
}

export function getContext() {
  return storage.getStore() ?? null;
}

export function setContext(partial) {
  const store = storage.getStore();
  if (store) Object.assign(store, partial);
}

export function getUserId() {
  return storage.getStore()?.userId ?? null;
}

export function getFoundationId() {
  return storage.getStore()?.foundationId ?? null;
}

export function getRole() {
  return storage.getStore()?.role ?? null;
}
