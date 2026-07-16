import type { AppLocale, CoachChatMessage, CoachMemory, CoachMemoryUpdate, FoodCatalogItem, GroceryEstimate, GroceryEstimateRequest, HealthDocumentSummary, MealPlanOption, NutritionTarget, UserProfile, WorkoutSession } from '@vitamate/domain';
import { supabase } from './supabase';

// Production and native builds must never fall back to loopback: on an iPhone,
// localhost is the phone itself. Local development explicitly overrides this
// value through apps/app/.env.local.
const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'https://api.vitamate.mx';

function apiBaseUrl(): string {
  if (typeof window === 'undefined') return configuredBaseUrl.replace(/\/v1$/, '');
  // Development always uses Vite's same-origin /v1 proxy. Besides keeping
  // localhost free of production CORS configuration, this also works for LAN
  // iPhone tests and HTTPS tunnels without exposing the local API directly.
  if (import.meta.env.DEV) return '';
  try {
    const configured = new URL(configuredBaseUrl);
    const configuredIsLoopback = ['localhost', '127.0.0.1'].includes(configured.hostname);
    const currentIsLan = !['localhost', '127.0.0.1'].includes(window.location.hostname);
    // La PWA en un iPhone no puede usar 127.0.0.1: es el propio iPhone. Si
    // el entorno local apunta a loopback, usamos el mismo host LAN que abrió
    // Vite y conservamos el puerto de la API.
    if (configuredIsLoopback && currentIsLan) return `${window.location.protocol}//${window.location.hostname}:3001`;
  } catch {
    // La configuración validada durante build sigue siendo la alternativa.
  }
  return configuredBaseUrl.replace(/\/v1$/, '');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const fetchWithToken = async (accessToken?: string) => fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(init?.headers ?? {}) },
  });
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  let response: Response;
  try {
    response = await fetchWithToken(session?.access_token);
    // A suspended iOS WebView can resume with the cached session just before
    // Supabase rotates its access token. Refresh once and transparently retry
    // the authenticated request instead of treating the account as Free.
    if (response.status === 401 && session && supabase) {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.data.session?.access_token) response = await fetchWithToken(refreshed.data.session.access_token);
    }
  } catch {
    throw new Error('No pudimos conectar con VITAMATE. Verifica tu conexión e inténtalo nuevamente.');
  }
  const data = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(data.message ?? `Error ${response.status}`);
  return data as T;
}

export type OtpVerificationType = 'email' | 'signup' | 'recovery';
export type OtpDelivery = 'otp' | 'magic_link';
export async function registerAccount(input: { email: string; password: string }): Promise<{ sent: true; verificationType: 'signup'; delivery: 'otp' }> {
  return request('/v1/auth/register', { method: 'POST', body: JSON.stringify(input) });
}
export async function resendRegistrationOtp(email: string): Promise<{ sent: true; verificationType: OtpVerificationType; delivery: 'otp' }> {
  return request('/v1/auth/resend-registration-code', { method: 'POST', body: JSON.stringify({ email }) });
}
export async function requestPasswordReset(email: string): Promise<{ sent: true; verificationType: 'recovery'; delivery: 'otp' }> {
  return request('/v1/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) });
}
export async function requestAuthOtp(input: { email: string; fullName: string; preferredName: string }): Promise<{ sent: true; verificationType: OtpVerificationType; delivery: OtpDelivery }> {
  return request('/v1/auth/request-otp', { method: 'POST', body: JSON.stringify(input) });
}
export function deleteAccount(): Promise<{ deleted: true }> {
  return request('/v1/auth/account', { method: 'DELETE' });
}

export interface BillingEntitlement {
  userId: string;
  plan: 'free' | 'premium';
  status: 'free' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused';
  billingInterval: 'month' | 'year' | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  trialUsed: boolean;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  source?: 'none' | 'stripe' | 'apple';
  appleProductId?: string | null;
}

export interface BillingOffer { interval: 'month' | 'year'; amount: number; currency: string; displayPrice?: string; trialAvailable?: boolean }
export function fetchBillingStatus(): Promise<{ entitlement: BillingEntitlement; configured: boolean; offers: BillingOffer[] }> {
  return request('/v1/billing/status');
}

export function reconcileCheckout(sessionId: string): Promise<{ entitlement: BillingEntitlement; reconciled: boolean; pending: boolean }> {
  return request('/v1/billing/reconcile-checkout', { method: 'POST', body: JSON.stringify({ sessionId }) });
}

export async function createCheckout(interval: 'month' | 'year', returnUrl: string): Promise<{ url: string; trialGranted: boolean }> {
  return request('/v1/billing/checkout', { method: 'POST', body: JSON.stringify({ interval, returnUrl }) });
}

export async function createBillingPortal(returnUrl: string): Promise<{ url: string }> {
  return request('/v1/billing/portal', { method: 'POST', body: JSON.stringify({ returnUrl }) });
}

export function verifyApplePurchase(input: { transactionId: string; jwsRepresentation: string }): Promise<{ entitlement: BillingEntitlement }> {
  return request('/v1/billing/apple/verify', { method: 'POST', body: JSON.stringify(input) });
}

export function registerPushDevice(input: { token: string; platform: 'ios'; environment: 'sandbox' | 'production' }): Promise<{ registered: true }> {
  return request('/v1/notifications/devices', { method: 'POST', body: JSON.stringify({ ...input, locale: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
}

export async function searchFoods(query: string, external = false): Promise<FoodCatalogItem[]> {
  const data = await request<{ items: FoodCatalogItem[] }>(`/v1/foods/search?q=${encodeURIComponent(query)}&external=${external}`);
  return data.items;
}

export async function findFoodByBarcode(barcode: string): Promise<FoodCatalogItem> {
  const data = await request<{ item: FoodCatalogItem }>(`/v1/foods/barcode/${encodeURIComponent(barcode)}`);
  return data.item;
}

export interface PhotoAnalysis {
  items: Array<{ name: string; brand: string | null; barcode: string | null; estimatedPortionG: number; calories: number; proteinG: number; carbohydratesG: number; fatG: number; confidence: number; dataSource: 'vision' | 'vitamate' | 'usda' | 'open_food_facts'; databaseMatchName: string | null; databaseMatchConfidence: number | null }>;
  totals: { calories: number; proteinG: number; carbohydratesG: number; fatG: number };
  overallConfidence: number;
  notes: string[];
  requiresConfirmation: true;
}

export async function analyzeFoodPhoto(imageDataUrl: string, locale: AppLocale): Promise<PhotoAnalysis> {
  const data = await request<{ analysis: PhotoAnalysis }>('/v1/foods/analyze-photo', { method: 'POST', body: JSON.stringify({ imageDataUrl, locale }) });
  return data.analysis;
}

export async function fetchExerciseGuides(): Promise<Record<string, string>> {
  const data = await request<{ guides: Record<string, string> }>('/v1/exercises/guides');
  return data.guides;
}

export async function fetchMealImages(): Promise<Record<string, string>> {
  const data = await request<{ images: Record<string, string> }>('/v1/nutrition/meal-images');
  return data.images;
}

export async function estimateGroceryCost(input: GroceryEstimateRequest): Promise<GroceryEstimate> {
  const data = await request<{ estimate: GroceryEstimate }>('/v1/nutrition/grocery-estimate', { method: 'POST', body: JSON.stringify(input) });
  return data.estimate;
}

export interface CoachChatContext {
  locale: AppLocale;
  currentDateTime: string;
  timezone: string;
  profile: Pick<UserProfile, 'preferredName' | 'primaryGoal' | 'activityLevel' | 'weeklyTrainingDays' | 'trainingMinutes' | 'equipment' | 'dietaryPattern' | 'coachStyle' | 'safetyFlags' | 'favoriteFoods' | 'dislikedFoods' | 'allergies' | 'preferredCuisines' | 'mealsPerDay' | 'cookingLevel' | 'supplements' | 'trainingPreference' | 'preferredSport' | 'mealPreparationPreference' | 'mealPrepStructure' | 'mealPrepRotationDays' | 'weeklyFoodBudgetMxn'>;
  nutritionTarget?: Pick<NutritionTarget, 'status' | 'calories' | 'proteinG' | 'carbohydratesG' | 'fatG'>;
  recentWorkouts: Array<Pick<WorkoutSession, 'workoutTitle' | 'durationMinutes' | 'perceivedEffort' | 'completedAt'>>;
  availableWorkouts: Array<{ title: string; focus: string; durationMinutes: number; exercises: string[] }>;
  todayNutrition?: { calories: number; proteinG: number; carbohydratesG: number; fatG: number };
  weeklyNutrition?: { consumed: { calories: number; proteinG: number; carbohydratesG: number; fatG: number }; target: { calories: number; proteinG: number; carbohydratesG: number; fatG: number }; balance: { calories: number; proteinG: number; carbohydratesG: number; fatG: number } };
  weeklyWorkout?: { sessions: number; targetSessions: number; minutes: number; targetMinutes: number; caloriesBurned: number; targetCalories: number; remainingMinutes: number; remainingCalories: number };
  weightTrend?: { latestKg: number; previousKg: number | null };
  healthDocuments: Array<Pick<HealthDocumentSummary, 'filename' | 'uploadedAt' | 'summary'>>;
  healthSummary?: { stepsToday?: number; restingHeartRate?: number; activeCaloriesToday?: number; source: string };
  mealPlanContext?: string;
  planChangeTarget?: { type: 'replace_meal' | 'replace_ingredient'; slotId?: string; ingredient?: string };
}

export type CoachAction =
  | { type: 'log_meal'; meal: { name: string; mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'; occurredAt: string; calories: number; proteinG: number; carbohydratesG: number; fatG: number } }
  | { type: 'log_workout'; workout: { title: string; activityType: 'strength' | 'cardio' | 'mobility' | 'sport' | 'other'; occurredAt: string; durationMinutes: number; caloriesBurned: number; perceivedEffort: number } }
  | { type: 'replace_plan_meal'; change: { slotId: string; option: MealPlanOption } }
  | { type: 'replace_plan_ingredient'; change: { slotId?: string; ingredientToReplace: string; replacementIngredient: string } };

export interface CoachReply {
  response: string;
  action: CoachAction | null;
  assistantMessage: CoachChatMessage;
  memoryUpdated: boolean;
  memoryUpdates: CoachMemoryUpdate[];
}

export async function sendCoachMessage(context: CoachChatContext, history: CoachChatMessage[], message: string, attachment?: string | { filename: string; mimeType: 'application/pdf'; dataUrl: string }, clientMessage?: CoachChatMessage, memory: CoachMemory[] = []): Promise<CoachReply> {
  return request<CoachReply>('/v1/coach/chat', {
    method: 'POST',
    body: JSON.stringify({
      ...context,
      recentWorkouts: context.recentWorkouts.map(({ workoutTitle, ...workout }) => ({ ...workout, title: workoutTitle })),
      history: history.slice(-10).map(({ role, content }) => ({ role, content })),
      message,
      clientMessage: clientMessage ? { id: clientMessage.id, content: clientMessage.content, createdAt: clientMessage.createdAt } : undefined,
      memory: memory.slice(0, 12).map(({ key, category, content, importance, confidence, expiresAt, updatedAt }) => ({ key, category, content, importance, confidence, expiresAt, updatedAt })),
      imageDataUrl: typeof attachment === 'string' ? attachment : undefined,
      document: typeof attachment === 'object' ? attachment : undefined,
    }),
  });
}

export async function fetchCoachHistory(limit = 100): Promise<CoachChatMessage[]> {
  if (!supabase) return [];
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) return [];
  const data = await request<{ messages: CoachChatMessage[] }>(`/v1/coach/history?limit=${Math.max(1, Math.min(100, limit))}`);
  return data.messages;
}

export interface RealtimeToken {
  value: string;
  expires_at?: number;
  session?: {
    model?: string;
    output_modalities?: string[];
    audio?: { output?: { voice?: string } };
  };
}

export interface RealtimeCallUsage {
  responses: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  inputTextTokens: number;
  inputAudioTokens: number;
  cachedTextTokens: number;
  cachedAudioTokens: number;
  outputTextTokens: number;
  outputAudioTokens: number;
}

export async function fetchRealtimeToken(context: CoachChatContext): Promise<RealtimeToken> {
  return request<RealtimeToken>('/v1/coach/realtime-token', {
    method: 'POST',
    body: JSON.stringify({ ...context, recentWorkouts: context.recentWorkouts.map(({ workoutTitle, ...workout }) => ({ ...workout, title: workoutTitle })) }),
  });
}

export async function recordCoachCall(input: { locale: AppLocale; durationSeconds: number; startedAt: string; endedAt: string; usage?: RealtimeCallUsage }): Promise<void> {
  await request<{ recorded: boolean }>('/v1/coach/calls', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
