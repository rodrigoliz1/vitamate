import { supabaseAdmin } from './supabase.js';

export interface OpenAiTokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export function parseOpenAiUsage(usage: unknown): OpenAiTokenUsage {
  const value = usage as {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
  } | undefined;
  return {
    inputTokens: Math.max(0, Math.round(value?.input_tokens ?? 0)),
    cachedInputTokens: Math.max(0, Math.round(value?.input_tokens_details?.cached_tokens ?? 0)),
    outputTokens: Math.max(0, Math.round(value?.output_tokens ?? 0)),
    totalTokens: Math.max(0, Math.round(value?.total_tokens ?? 0)),
  };
}

export async function recordAiUsage(input: {
  userId: string;
  task: string;
  model: string;
  usage: OpenAiTokenUsage;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from('ai_usage_events').insert({
    user_id: input.userId,
    task: input.task,
    model: input.model,
    input_tokens: input.usage.inputTokens,
    cached_input_tokens: input.usage.cachedInputTokens,
    output_tokens: input.usage.outputTokens,
    total_tokens: input.usage.totalTokens,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}
