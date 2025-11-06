import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  requestId: string | null;
  method?: string;
  path?: string;
  startTime?: number;
  userId?: string | null;
}

const als = new AsyncLocalStorage<RequestContext>();

export function withCtx<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function getCtx(): RequestContext | null {
  return als.getStore() ?? null;
}
