interface RequestContext {
    requestId: string | null;
    method?: string;
    path?: string;
    startTime?: number;
    userId?: string | null;
}
export declare function withCtx<T>(ctx: RequestContext, fn: () => T): T;
export declare function getCtx(): RequestContext | null;
export {};
//# sourceMappingURL=request-context.d.ts.map