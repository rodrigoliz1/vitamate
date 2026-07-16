import { requireSupabase } from '../services/supabase.js';

export const VOICE_CREDIT_PACKAGES = [
  {
    id: 'voice_5',
    minutes: 5,
    seconds: 300,
    amount: 5900,
    currency: 'mxn',
    appleProductId: 'mx.vitamate.voice.5',
  },
  {
    id: 'voice_10',
    minutes: 10,
    seconds: 600,
    amount: 9900,
    currency: 'mxn',
    appleProductId: 'mx.vitamate.voice.10',
  },
  {
    id: 'voice_30',
    minutes: 30,
    seconds: 1800,
    amount: 24900,
    currency: 'mxn',
    appleProductId: 'mx.vitamate.voice.30',
  },
  {
    id: 'voice_60',
    minutes: 60,
    seconds: 3600,
    amount: 39900,
    currency: 'mxn',
    appleProductId: 'mx.vitamate.voice.60',
  },
] as const;

export type VoicePackageId = (typeof VOICE_CREDIT_PACKAGES)[number]['id'];
export interface VoiceCreditBalance {
  cycleStart: string;
  cycleEnd: string;
  monthlyAllowanceSeconds: number;
  monthlyUsedSeconds: number;
  monthlyRemainingSeconds: number;
  extraBalanceSeconds: number;
  totalRemainingSeconds: number;
}

function rpcError(error: { message?: string } | null): never {
  const message = error?.message ?? 'No fue posible consultar el tiempo de llamada.';
  if (message.includes('VOICE_CREDITS_EXHAUSTED')) {
    throw Object.assign(new Error('Ya utilizaste tus minutos disponibles. Puedes agregar más tiempo para continuar.'), { statusCode: 402, code: 'VOICE_CREDITS_EXHAUSTED' });
  }
  if (message.includes('VOICE_CALL_ALREADY_OPEN')) {
    throw Object.assign(new Error('Ya tienes una llamada en curso. Ciérrala antes de iniciar otra.'), { statusCode: 409, code: 'VOICE_CALL_ALREADY_OPEN' });
  }
  if (message.includes('VOICE_CALL_NOT_FOUND')) {
    throw Object.assign(new Error('No encontramos esta llamada.'), {
      statusCode: 404,
      code: 'VOICE_CALL_NOT_FOUND',
    });
  }
  throw error;
}

function mapBalance(row: Record<string, unknown>): VoiceCreditBalance {
  return {
    cycleStart: String(row.cycle_start),
    cycleEnd: String(row.cycle_end),
    monthlyAllowanceSeconds: Number(row.monthly_allowance_seconds),
    monthlyUsedSeconds: Number(row.monthly_used_seconds),
    monthlyRemainingSeconds: Number(row.monthly_remaining_seconds),
    extraBalanceSeconds: Number(row.extra_balance_seconds),
    totalRemainingSeconds: Number(row.total_remaining_seconds),
  };
}

export function voicePackage(id: string) {
  return VOICE_CREDIT_PACKAGES.find((item) => item.id === id) ?? null;
}

export function voicePackageForAppleProduct(productId: string) {
  return VOICE_CREDIT_PACKAGES.find((item) => item.appleProductId === productId) ?? null;
}

export async function getVoiceCreditBalance(userId: string): Promise<VoiceCreditBalance> {
  const { data, error } = await requireSupabase().rpc('get_voice_credit_balance', { p_user_id: userId });
  if (error) rpcError(error);
  return mapBalance((data as Record<string, unknown>[])[0]);
}

export async function reserveVoiceCall(userId: string): Promise<{ callSessionId: string; maxDurationSeconds: number }> {
  const { data, error } = await requireSupabase().rpc('reserve_voice_call', {
    p_user_id: userId,
  });
  if (error) rpcError(error);
  const row = (data as Record<string, unknown>[])[0];
  return {
    callSessionId: String(row.call_session_id),
    maxDurationSeconds: Number(row.max_duration_seconds),
  };
}

export async function startVoiceCall(userId: string, callSessionId: string): Promise<void> {
  const { data, error } = await requireSupabase().rpc('start_voice_call', {
    p_user_id: userId,
    p_call_id: callSessionId,
  });
  if (error) rpcError(error);
  if (!data) rpcError({ message: 'VOICE_CALL_NOT_FOUND' });
}

export async function heartbeatVoiceCall(userId: string, callSessionId: string): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc('heartbeat_voice_call', {
    p_user_id: userId,
    p_call_id: callSessionId,
  });
  if (error) rpcError(error);
  return data === true;
}

export async function completeVoiceCall(userId: string, callSessionId: string) {
  const { data, error } = await requireSupabase().rpc('complete_voice_call', {
    p_user_id: userId,
    p_call_id: callSessionId,
  });
  if (error) rpcError(error);
  const row = (data as Record<string, unknown>[])[0];
  return {
    consumedSeconds: Number(row.consumed_seconds),
    monthlyConsumedSeconds: Number(row.monthly_consumed_seconds),
    extraConsumedSeconds: Number(row.extra_consumed_seconds),
  };
}

export async function cancelVoiceCall(userId: string, callSessionId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('cancel_voice_call', {
    p_user_id: userId,
    p_call_id: callSessionId,
  });
  if (error) rpcError(error);
}

export async function grantVoiceCredit(input: { userId: string; provider: 'stripe' | 'apple' | 'admin'; reference: string; packageId: VoicePackageId; seconds: number; amount: number; currency: string }): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc('grant_voice_credit', {
    p_user_id: input.userId,
    p_provider: input.provider,
    p_reference: input.reference,
    p_package_id: input.packageId,
    p_seconds: input.seconds,
    p_amount_minor: input.amount,
    p_currency: input.currency,
  });
  if (error) rpcError(error);
  return data === true;
}
