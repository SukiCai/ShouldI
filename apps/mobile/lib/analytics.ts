import { apiPostJson } from '@/lib/api';

type ProductEventName =
  | 'decision_completed'
  | 'action_committed'
  | 'outcome_replayed'
  | 'confidence_delta'
  | 'prediction_logged'
  | 'vote_cast';

export async function trackProductEvent(params: {
  name: ProductEventName;
  decisionRecordId?: string;
  cardId?: string;
  value?: number;
  metadata?: Record<string, unknown>;
}) {
  const event = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: params.name,
    decisionRecordId: params.decisionRecordId,
    cardId: params.cardId,
    value: params.value,
    metadata: params.metadata ?? {},
    at: Date.now(),
  };
  try {
    await apiPostJson('/v1/events', { events: [event] });
  } catch {
    // Non-blocking telemetry in MVP.
  }
}

