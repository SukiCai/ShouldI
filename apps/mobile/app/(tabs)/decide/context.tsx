import type { PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as React from 'react';
import { Alert } from 'react-native';

import { apiPostJson } from '@/lib/api';
import {
  ChatRequestSchema,
  ChatResponseSchema,
  type ChatResponse,
  type DecisionCategory,
  type DecideInterviewFinalDecision,
} from '@shouldi/contracts';

type KeyMoment = DecideInterviewFinalDecision['keyMoments'][number];

export type DiscussDraftPollOption = {
  id: string;
  label: string;
};

export function defaultPollOptions(): DiscussDraftPollOption[] {
  return [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
  ];
}

export type DecideDraft = {
  category?: DecisionCategory;
  title: string;
  constraints: string;
  successCriteria: string;
  /** Yes/no crowd question — surfaced on Explore reel */
  communityChallengeQuestion: string;
  /** Harmence leaning headline */
  communityAiVerdictLine: string;
  /** Tradeoffs / risks / rationale — summarized for peers */
  communityAiBecause: string;
  hook: string;
  tension: string;
  pollOptions: DiscussDraftPollOption[];
  aiSuggestedOptionId: string;
  /** 0-100 integer, derived from 1 - ambiguity at session completion */
  aiConfidenceScore?: number;
  discussionPreview: string[];
  rewardPoints: number;
  expertVerdicts: DecideInterviewFinalDecision['expertVerdicts'];
  keyMoments: KeyMoment[];
};

const STORAGE_KEY = 'shouldi/decide-draft';

function hydrateCommunityFromBriefing(parsed: ChatResponse): Pick<
  DecideDraft,
  'communityAiVerdictLine' | 'communityAiBecause'
> {
  const first = parsed.sections[0];
  const stitched = parsed.sections
    .map((s) => (s.title ? `${s.title}\n${s.body}` : s.body))
    .join('\n\n')
    .trim();
  return {
    communityAiVerdictLine: first?.title?.trim() || 'Recommendation',
    communityAiBecause: stitched.slice(0, 3200),
  };
}

export type DecideWizardContextValue = {
  draft: DecideDraft;
  updateDraft(patch: Partial<DecideDraft>): void;
  reset(): void;
  lastResponse: ChatResponse | null;
  rememberResponse(parsed: ChatResponse): void;
  /** Runs `/v1/chat`, hydrates Explore card preview fields, stays on Review briefing until you open full briefing. */
  submitBriefing(): Promise<void>;
  /** Mock hand-off — wire to POST /requests later */
  postCommunityValidationCard(): void;
  busy: boolean;
  error?: string | null;
};

const DecideWizardContext = React.createContext<DecideWizardContextValue | null>(null);

export function useDecideWizard() {
  const ctx = React.useContext(DecideWizardContext);
  if (!ctx) {
    throw new Error('useDecideWizard must be used inside provider');
  }
  return ctx;
}

const blankDraft = (): DecideDraft => ({
  category: undefined,
  title: '',
  constraints: '',
  successCriteria: '',
  communityChallengeQuestion: '',
  communityAiVerdictLine: '',
  communityAiBecause: '',
  hook: '',
  tension: '',
  pollOptions: defaultPollOptions(),
  aiSuggestedOptionId: 'yes',
  discussionPreview: [],
  rewardPoints: 10,
  expertVerdicts: [],
  keyMoments: [],
});

export default function DecideWizardProvider({ children }: PropsWithChildren) {
  const [draft, setDraftState] = React.useState<DecideDraft>(() => blankDraft());
  const [lastResponse, setLastResponseRaw] = React.useState<ChatResponse | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((persisted) => {
        if (persisted) {
          const parsed = JSON.parse(persisted) as Partial<DecideDraft>;
          setDraftState({ ...blankDraft(), ...parsed });
        }
      })
      .catch(() => null);
  }, []);

  React.useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft)).catch(() => null);
  }, [draft]);

  const updateDraft = React.useCallback((patch: Partial<DecideDraft>) => {
    setDraftState((previous) => ({ ...previous, ...patch }));
    setError(null);
  }, []);

  const reset = React.useCallback(() => {
    setDraftState(blankDraft());
    setLastResponseRaw(null);
    setError(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => null);
  }, []);

  const rememberResponse = React.useCallback((parsed: ChatResponse) => {
    setLastResponseRaw(parsed);
  }, []);

  const submitBriefing = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const validated = ChatRequestSchema.parse({
        category: draft.category,
        title: draft.title,
        constraints: draft.constraints,
        successCriteria: draft.successCriteria,
      });

      const payload = await apiPostJson('/v1/chat', validated);
      const parsed = ChatResponseSchema.parse(payload);
      rememberResponse(parsed);
      const hydrate = hydrateCommunityFromBriefing(parsed);
      updateDraft({
        ...hydrate,
        communityAiBecause: hydrate.communityAiBecause.trim() || hydrate.communityAiBecause,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went sideways.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [
    draft.category,
    draft.constraints,
    draft.successCriteria,
    draft.title,
    rememberResponse,
    updateDraft,
  ]);

  const postCommunityValidationCard = React.useCallback(() => {
    if (!draft.category || !draft.title.trim()) {
      setError('Category and headline are required before posting.');
      return;
    }
    const pollQuestion = draft.communityChallengeQuestion.trim() || draft.title.trim();
    if (
      !pollQuestion ||
      !draft.hook.trim() ||
      !draft.tension.trim() ||
      !draft.communityAiVerdictLine.trim() ||
      !draft.communityAiBecause.trim() ||
      draft.pollOptions.some((option) => !option.label.trim())
    ) {
      setError('Fill the poll question, hook, tradeoff, Harmence stance, and option labels before sending to Explore.');
      return;
    }
    setError(null);
    const keyContext = draft.keyMoments
      .filter((m) => m.impact?.trim())
      .map((m) => m.impact!.trim())
      .slice(0, 4);
    const aiValidation = {
      verdictLine: draft.communityAiVerdictLine.trim(),
      verdictBecause: draft.communityAiBecause.trim().slice(0, 400),
      agreeWithAiVotes: 0,
      disagreeWithAiVotes: 0,
      ...(draft.aiConfidenceScore != null ? { confidenceScore: draft.aiConfidenceScore } : {}),
      ...(keyContext.length > 0 ? { keyContext } : {}),
    };
    if (__DEV__) console.debug('[postCard] aiValidation:', JSON.stringify(aiValidation));
    Alert.alert(
      'Sent to Explore',
      'Peers will thumbs up/down on Harmence stance, then answer your challenge. (Demo queues locally — swap for POST /requests when wired.)',
      [{ text: 'Open Explore', onPress: () => router.replace('/(tabs)/explore') }],
    );
  }, [draft]);

  const contextValue = React.useMemo<DecideWizardContextValue>(() => {
    return {
      draft,
      updateDraft,
      reset,
      lastResponse,
      rememberResponse,
      submitBriefing,
      postCommunityValidationCard,
      busy,
      error,
    };
  }, [
    busy,
    draft,
    error,
    lastResponse,
    postCommunityValidationCard,
    rememberResponse,
    reset,
    submitBriefing,
    updateDraft,
  ]);

  return <DecideWizardContext.Provider value={contextValue}>{children}</DecideWizardContext.Provider>;
}
