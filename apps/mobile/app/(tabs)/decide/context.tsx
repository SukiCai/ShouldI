import type { PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as React from 'react';

import { apiPostJson } from '@/lib/api';
import {
  ChatRequestSchema,
  ChatResponseSchema,
  type ChatResponse,
  type DecisionCategory,
} from '@shouldi/contracts';

export type DecideDraft = {
  category?: DecisionCategory;
  title: string;
  constraints: string;
  successCriteria: string;
};

const STORAGE_KEY = 'shouldi/decide-draft';

export type DecideWizardContextValue = {
  draft: DecideDraft;
  updateDraft(patch: Partial<DecideDraft>): void;
  reset(): void;
  lastResponse: ChatResponse | null;
  rememberResponse(parsed: ChatResponse): void;
  submitBriefing(): Promise<void>;
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
          const parsed = JSON.parse(persisted) as DecideDraft;
          setDraftState((previous) => ({ ...previous, ...parsed }));
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
      router.replace('/(tabs)/decide/result');
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
  ]);

  const contextValue = React.useMemo<DecideWizardContextValue>(() => {
    return {
      draft,
      updateDraft,
      reset,
      lastResponse,
      rememberResponse,
      submitBriefing,
      busy,
      error,
    };
  }, [busy, draft, error, lastResponse, rememberResponse, reset, submitBriefing, updateDraft]);

  return <DecideWizardContext.Provider value={contextValue}>{children}</DecideWizardContext.Provider>;
}
