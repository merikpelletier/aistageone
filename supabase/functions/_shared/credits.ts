import { assertServiceEnabled } from './modelControlRuntime.ts';
import { createClient, SupabaseClient, User } from 'npm:@supabase/supabase-js@2';

type ChargeResult = {
  ok: boolean;
  code?: string;
  charge_id?: string;
  cost?: number;
  balance?: number;
  balance_after?: number;
  status?: string;
  tool_id?: string;
};

export type CreditCharge = {
  id: string | null;
  cost: number;
  balanceAfter: number | null;
  bypassed: boolean;
};

export type CreditBillingContext = {
  service: SupabaseClient;
  user: User;
  idempotencyKey: string;
};

export class CreditError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(message: string, status: number, code: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'CreditError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isAdmin(user: User) {
  const configuredAdmin = (Deno.env.get('ADMIN_EMAIL') || '').trim().toLowerCase();
  return user.app_metadata?.role === 'admin'
    || Boolean(configuredAdmin && user.email?.trim().toLowerCase() === configuredAdmin);
}

function readIdempotencyKey(request: Request) {
  const supplied = request.headers.get('x-idempotency-key')?.trim();
  return supplied || crypto.randomUUID();
}

export async function createCreditBillingContext(request: Request): Promise<CreditBillingContext> {
  const authorization = request.headers.get('Authorization') || '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const scoped = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: authorization ? { Authorization: authorization } : {} },
    auth: { persistSession: false },
  });
  const { data, error } = await scoped.auth.getUser();
  if (error || !data.user?.email) {
    throw new CreditError('Unauthorized', 401, 'unauthorized');
  }

  return {
    user: data.user,
    service: createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    }),
    idempotencyKey: readIdempotencyKey(request),
  };
}

export async function reserveCredits({
  service,
  user,
  idempotencyKey,
  toolId,
  provider,
  relatedEntity,
}: CreditBillingContext & {
  toolId: string;
  provider: string;
  relatedEntity?: string;
}): Promise<CreditCharge> {
  await assertServiceEnabled();
  if (isAdmin(user)) {
    return { id: null, cost: 0, balanceAfter: null, bypassed: true };
  }

  const { data, error } = await service.rpc('reserve_ai_credit_charge', {
    p_user_id: user.id,
    p_user_email: user.email,
    p_tool_id: toolId,
    p_provider: provider,
    p_related_entity: relatedEntity || toolId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(`Credit reservation failed: ${error.message}`);

  const result = data as ChargeResult;
  if (!result?.ok) {
    if (result?.code === 'insufficient_credits') {
      throw new CreditError('Insufficient credits', 402, result.code, {
        required: result.required,
        balance: result.balance,
      });
    }
    if (result?.code === 'pricing_not_configured') {
      throw new CreditError(
        `Credit price is not configured for ${result.tool_id || toolId}`,
        503,
        result.code,
        { tool_id: result.tool_id || toolId },
      );
    }
    throw new CreditError('Credit reservation failed', 409, result?.code || 'credit_reservation_failed');
  }

  return {
    id: result.charge_id || null,
    cost: Number(result.cost || 0),
    balanceAfter: result.balance_after == null ? null : Number(result.balance_after),
    bypassed: false,
  };
}

export async function completeCreditCharge(service: SupabaseClient, charge: CreditCharge) {
  if (!charge.id) return;
  const { data, error } = await service.rpc('complete_ai_credit_charge', { p_charge_id: charge.id });
  if (error || !(data as ChargeResult)?.ok) {
    throw new Error(`Credit completion failed: ${error?.message || (data as ChargeResult)?.code || 'unknown error'}`);
  }
}

export async function refundCreditCharge(
  service: SupabaseClient,
  charge: CreditCharge | null,
  cause: unknown,
) {
  if (!charge?.id) return;
  const message = cause instanceof Error ? cause.message : String(cause);
  const { error } = await service.rpc('refund_ai_credit_charge', {
    p_charge_id: charge.id,
    p_error_message: message.slice(0, 1000),
  });
  if (error) console.error('Credit refund failed:', error.message);
}

export async function withCreditCharge<T>(
  context: CreditBillingContext & { toolId: string; provider: string; relatedEntity?: string },
  operation: () => Promise<T>,
) {
  const charge = await reserveCredits(context);
  try {
    const result = await operation();
    await completeCreditCharge(context.service, charge);
    return { result, charge };
  } catch (error) {
    await refundCreditCharge(context.service, charge, error);
    throw error;
  }
}
