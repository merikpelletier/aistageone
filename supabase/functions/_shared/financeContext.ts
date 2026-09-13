import { AsyncLocalStorage } from 'node:async_hooks';

export type FinanceContext = {
  requestId: string; functionName: string; request: Request;
  quote?: any; quoteUser?: any; service?: any; chargeId?: string; toolId?: string;
  usedLines: Record<string, number>;
};
export const financeContext = new AsyncLocalStorage<FinanceContext>();
