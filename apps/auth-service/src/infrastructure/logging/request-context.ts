import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string | null;
  method?: string;
  path?: string;
  startTime?: number;
  userId?: string | null;
}

export const als = new AsyncLocalStorage<RequestContext>();

export function setCtx(ctx: RequestContext) {
  // Clava el contexto en el hilo asíncrono actual
  als.enterWith(ctx);
}

export function getCtx(): RequestContext | null {
  return als.getStore() ?? null;
}
