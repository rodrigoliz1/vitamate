import { randomUUID } from 'node:crypto';
import type { CoachConversationMessage, CoachMemoryUpdate } from '../providers/openaiCoach.js';
import { requireSupabase } from '../services/supabase.js';

export interface StoredCoachMessage extends CoachConversationMessage {
  id: string;
  createdAt: string;
}

export interface StoredCoachMemory {
  key: string;
  category: CoachMemoryUpdate['category'];
  content: string;
  importance: number;
  lastConfirmedAt: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function ensureThread(userId: string): Promise<{ id: string; conversationSummary: string; summarizedMessageCount: number }> {
  const supabase = requireSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('coach_threads')
    .upsert({ user_id: userId, updated_at: now }, { onConflict: 'user_id' })
    .select('id,conversation_summary,summarized_message_count')
    .single();
  if (error) throw error;
  return {
    id: String(data.id),
    conversationSummary: String(data.conversation_summary ?? ''),
    summarizedMessageCount: Number(data.summarized_message_count ?? 0),
  };
}

export async function loadCoachState(userId: string, messageLimit = 10): Promise<{
  threadId: string;
  messages: StoredCoachMessage[];
  memories: StoredCoachMemory[];
  conversationSummary: string;
  totalMessageCount: number;
  summarizedMessageCount: number;
}> {
  const supabase = requireSupabase();
  const thread = await ensureThread(userId);
  const [{ data: messageRows, error: messageError }, { data: memoryRows, error: memoryError }, { count: messageCount, error: countError }] = await Promise.all([
    supabase.from('coach_messages').select('id,role,content,created_at').eq('thread_id', thread.id).order('created_at', { ascending: false }).limit(messageLimit),
    supabase.from('coach_memories').select('memory_key,category,content,importance,last_confirmed_at,expires_at').eq('user_id', userId).eq('active', true).order('importance', { ascending: false }).order('last_confirmed_at', { ascending: false }).limit(40),
    supabase.from('coach_messages').select('id', { count: 'exact', head: true }).eq('thread_id', thread.id),
  ]);
  if (messageError) throw messageError;
  if (memoryError) throw memoryError;
  if (countError) throw countError;
  const now = Date.now();
  return {
    threadId: thread.id,
    messages: (messageRows ?? []).reverse().map((row) => ({
      id: String(row.id),
      role: row.role as StoredCoachMessage['role'],
      content: String(row.content),
      createdAt: String(row.created_at),
    })),
    memories: (memoryRows ?? [])
      .filter((row) => !row.expires_at || new Date(String(row.expires_at)).getTime() > now)
      .map((row) => ({
        key: String(row.memory_key),
        category: row.category as StoredCoachMemory['category'],
        content: String(row.content),
        importance: Number(row.importance),
        lastConfirmedAt: String(row.last_confirmed_at),
      })),
    conversationSummary: thread.conversationSummary,
    totalMessageCount: messageCount ?? 0,
    summarizedMessageCount: thread.summarizedMessageCount,
  };
}

export async function loadMessagesForCoachSummary(threadId: string, limit = 30): Promise<StoredCoachMessage[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from('coach_messages').select('id,role,content,created_at').eq('thread_id', threadId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).reverse().map((row) => ({ id: String(row.id), role: row.role as StoredCoachMessage['role'], content: String(row.content), createdAt: String(row.created_at) }));
}

export async function persistCoachSummary(input: { userId: string; threadId: string; summary: string; summarizedMessageCount: number }): Promise<void> {
  const { error } = await requireSupabase().from('coach_threads').update({
    conversation_summary: input.summary,
    summarized_message_count: input.summarizedMessageCount,
    summary_updated_at: new Date().toISOString(),
  }).eq('id', input.threadId).eq('user_id', input.userId);
  if (error) throw error;
}

export async function persistCoachExchange(input: {
  userId: string;
  threadId: string;
  clientMessage?: { id?: string; content: string; createdAt?: string };
  assistantContent: string;
  memoryUpdates: CoachMemoryUpdate[];
}): Promise<{ userMessage: StoredCoachMessage; assistantMessage: StoredCoachMessage; memoryUpdated: boolean }> {
  const supabase = requireSupabase();
  const now = new Date().toISOString();
  const userMessage: StoredCoachMessage = {
    id: input.clientMessage?.id && uuidPattern.test(input.clientMessage.id) ? input.clientMessage.id : randomUUID(),
    role: 'user',
    content: input.clientMessage?.content.trim() || 'Mensaje enviado a VITACOACH',
    createdAt: input.clientMessage?.createdAt ?? now,
  };
  const assistantMessage: StoredCoachMessage = { id: randomUUID(), role: 'assistant', content: input.assistantContent, createdAt: now };
  const { error: messageError } = await supabase.from('coach_messages').upsert([
    { id: userMessage.id, user_id: input.userId, thread_id: input.threadId, role: userMessage.role, content: userMessage.content, created_at: userMessage.createdAt, metadata: { source: 'vitacoach_chat' } },
    { id: assistantMessage.id, user_id: input.userId, thread_id: input.threadId, role: assistantMessage.role, content: assistantMessage.content, created_at: assistantMessage.createdAt, metadata: { source: 'vitacoach_chat' } },
  ]);
  if (messageError) throw messageError;

  let memoryUpdated = false;
  for (const update of input.memoryUpdates.slice(0, 3)) {
    if (update.operation === 'delete') {
      const { error } = await supabase.from('coach_memories').update({ active: false, last_confirmed_at: now }).eq('user_id', input.userId).eq('memory_key', update.key);
      if (error) throw error;
      memoryUpdated = true;
      continue;
    }
    const expiresAt = update.ttlDays === null ? null : new Date(Date.now() + update.ttlDays * 86_400_000).toISOString();
    const { error } = await supabase.from('coach_memories').upsert({
      user_id: input.userId,
      memory_key: update.key,
      category: update.category,
      content: update.content,
      importance: update.importance,
      confidence: update.confidence,
      sensitivity: update.category === 'health_context' ? 'health' : 'standard',
      source_message_id: userMessage.id,
      active: true,
      last_confirmed_at: now,
      expires_at: expiresAt,
    }, { onConflict: 'user_id,memory_key' });
    if (error) throw error;
    memoryUpdated = true;
  }

  const { error: threadError } = await supabase.from('coach_threads').update({ updated_at: now, last_message_at: now }).eq('id', input.threadId).eq('user_id', input.userId);
  if (threadError) throw threadError;
  return { userMessage, assistantMessage, memoryUpdated };
}

export async function persistCoachCall(input: {
  userId: string;
  durationSeconds: number;
  startedAt: string;
  endedAt: string;
  locale: 'es-MX' | 'en-US';
}): Promise<StoredCoachMessage> {
  const supabase = requireSupabase();
  const thread = await ensureThread(input.userId);
  const duration = Math.max(0, Math.round(input.durationSeconds));
  const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
  const seconds = (duration % 60).toString().padStart(2, '0');
  const message: StoredCoachMessage = {
    id: randomUUID(),
    role: 'assistant',
    content: input.locale === 'en-US'
      ? `📞 Voice call with VITACOACH · ${minutes}:${seconds}`
      : `📞 Llamada con VITACOACH · ${minutes}:${seconds}`,
    createdAt: input.endedAt,
  };
  const { error } = await supabase.from('coach_messages').insert({
    id: message.id,
    user_id: input.userId,
    thread_id: thread.id,
    role: message.role,
    content: message.content,
    created_at: message.createdAt,
    metadata: {
      source: 'vitacoach_call',
      duration_seconds: duration,
      started_at: input.startedAt,
      ended_at: input.endedAt,
    },
  });
  if (error) throw error;
  const { error: threadError } = await supabase.from('coach_threads').update({
    updated_at: input.endedAt,
    last_message_at: input.endedAt,
  }).eq('id', thread.id).eq('user_id', input.userId);
  if (threadError) throw threadError;
  return message;
}

export async function listCoachMessages(userId: string, limit: number, before?: string): Promise<StoredCoachMessage[]> {
  const supabase = requireSupabase();
  const thread = await ensureThread(userId);
  let query = supabase.from('coach_messages').select('id,role,content,created_at').eq('thread_id', thread.id).order('created_at', { ascending: false }).limit(limit);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).reverse().map((row) => ({ id: String(row.id), role: row.role as StoredCoachMessage['role'], content: String(row.content), createdAt: String(row.created_at) }));
}

export async function seedCoachMemories(userId: string, memories: Array<{
  key: string;
  category: CoachMemoryUpdate['category'];
  content: string;
  importance: number;
  confidence: number;
  expiresAt: string | null;
  updatedAt: string;
}>): Promise<void> {
  if (!memories.length) return;
  const supabase = requireSupabase();
  const rows = memories.slice(0, 40).map((memory) => ({
    user_id: userId,
    memory_key: memory.key,
    category: memory.category,
    content: memory.content,
    importance: memory.importance,
    confidence: memory.confidence,
    sensitivity: memory.category === 'health_context' ? 'health' : 'standard',
    active: true,
    last_confirmed_at: memory.updatedAt,
    expires_at: memory.expiresAt,
  }));
  const { error } = await supabase.from('coach_memories').upsert(rows, { onConflict: 'user_id,memory_key' });
  if (error) throw error;
}
