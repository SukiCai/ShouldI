import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { ctaStyles } from '@/components/screen/ctaStyles';
import { TabHeaderIconButton, TabScreenHeader } from '@/components/screen/TabScreenHeader';
import { tabScreenStyles } from '@/components/screen/tabScreenStyles';
import { resolveAppChromatics } from '@/constants/appChromatics';
import {
  council,
  palette,
  profileNeutralStroke,
  radius,
  screenContentGutter,
  semantic,
  spacing,
  themeSurface,
  typography,
} from '@/constants/theme';
import { apiGetJson, apiPostJson } from '@/lib/api';
import { HARMENCE_OFFLINE_BUBBLE, userFacingApiError } from '@/lib/userFacingErrors';
import {
  useViewerEntitlements,
  type CouncilUnlockMethod,
} from '@/lib/useViewerEntitlements';
import type { DecisionCategory } from '@shouldi/contracts';
import {
  DecideInterviewSessionDetailSchema,
  DecideInterviewSessionsListSchema,
  DecideInterviewTurnRequestSchema,
  DecideInterviewTurnResponseSchema,
  type DecideInterviewBubble,
  type DecideInterviewChoiceOption,
  type DecideInterviewChoicePrompt,
  type DecideInterviewExpert,
  type DecideInterviewFinalDecision,
} from '@shouldi/contracts';

import { CouncilPaywallSheet } from './components/CouncilPaywallSheet';
import { DecideModeSegment } from './components/DecideModeSegment';
import { DecideSessionStatus } from './components/DecideSessionStatus';
import { DecideSessionsSheet } from './components/DecideSessionsSheet';
import {
  ChamberJoinChatRow,
  CouncilVoteTally,
  ExpertGlyph,
  ThinkingRow,
} from './components/DecideThreadParts';
import { ExpertRosterSheet } from './components/ExpertRosterSheet';
import {
  appendExpertJoinRows,
  assistantBubbleBody,
  buildThreadItems,
  choicePromptHeadline,
  councilVoteStamp,
  councilVoteTally,
  expertCouncilSummary,
  formatSenderDisplay,
  joinAnchorAt,
  joinContextForExpert,
  mergeDeduped,
  shouldShowThreadSenderEyebrow,
  threadItemKey,
  threadSenderLabel,
  type DecideThreadItem,
  type ExpertJoinRow,
} from './components/threadHelpers';
import { useDecideWizard } from './context';

const readable: Record<DecisionCategory, string> = {
  life: 'Life path',
  career: 'Career move',
  relationship: 'Relationship',
  money: 'Money trade-off',
};

const STARTER_CHIPS = [
  { short: 'Co-op offer', prompt: 'Should I accept this co-op offer?' },
  { short: 'Job offer', prompt: 'Should I take this full-time offer?' },
  { short: 'Break up', prompt: 'Should I end this relationship?' },
  { short: 'Big purchase', prompt: 'Should I make this major purchase now?' },
] as const;

const COUNCIL_GRADIENT_DARK = council.gradientDark;
const COUNCIL_GRADIENT_LIGHT = council.gradientLight;

function progressRatio(progress: NonNullable<DecideInterviewChoicePrompt['progress']>): number {
  if (progress.ambiguity !== undefined) {
    // ambiguity 1.0 → 0.20 maps to progress 0 → 0.90
    return Math.min(0.90, Math.max(0, (1.0 - progress.ambiguity) / 0.80));
  }
  if (progress.mode === 'adaptive' || !progress.total) {
    return Math.min(0.82, 0.34 + progress.checked * 0.08);
  }
  return Math.min(1, Math.max(0, progress.checked / progress.total));
}

export default function DecideCategoryScreen() {
  const params = useLocalSearchParams<{ category?: DecisionCategory }>();
  const { draft, updateDraft } = useDecideWizard();
  const {
    balance: pointsBalance,
    hydrated: entitlementsHydrated,
    isPremium,
    canAccessCouncil,
    canUseCouncilWithPoints,
    councilSessionCost,
    unlockCouncilWithPoints,
    refundCouncilPoints,
    resolveCouncilUnlock,
    grantDevPoints,
    activatePremium,
  } = useViewerEntitlements();
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const insets = useSafeAreaInsets();
  const isDark = scheme === 'dark';
  const chrom = React.useMemo(() => resolveAppChromatics(isDark, surface), [isDark, surface]);

  const colors = React.useMemo(
    () => ({
      pageBg: surface.canvas,
      composerBg: surface.groupedSurface,
      composerBorder: surface.groupedBorder,
      cardBg: surface.groupedSurface,
      cardBorder: surface.groupedBorder,
      headerHairline: surface.hairline,
      muted: surface.textMuted,
      primaryTxt: surface.textPrimary,
      displayTxt: surface.textDisplay,
      sendFab: semantic.actionPrimary,
      modalBg: isDark ? surface.canvasSecondary : surface.sheet,
    }),
    [isDark, surface],
  );

  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<DecideInterviewBubble[]>([]);
  const [input, setInput] = React.useState('');
  const [booting, setBooting] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sessionsOpen, setSessionsOpen] = React.useState(false);
  const [sessions, setSessions] = React.useState<{ id: string; preview: string; updatedAt: number }[]>([]);
  const [listLoading, setListLoading] = React.useState(false);
  const [hermesIntegrated, setHermesIntegrated] = React.useState(false);
  const [activeExperts, setActiveExperts] = React.useState<DecideInterviewExpert[]>([]);
  const [expertJoinRows, setExpertJoinRows] = React.useState<ExpertJoinRow[]>([]);
  const [recentJoinExpertIds, setRecentJoinExpertIds] = React.useState<Set<string>>(() => new Set());
  const [choicePrompt, setChoicePrompt] = React.useState<DecideInterviewChoicePrompt | null>(null);
  const [isTypingCustomChoice, setIsTypingCustomChoice] = React.useState(false);
  const [customChoice, setCustomChoice] = React.useState('');
  const [finalReady, setFinalReady] = React.useState(false);
  const [finalDecision, setFinalDecision] = React.useState<DecideInterviewFinalDecision | null>(null);
  const [mode, setMode] = React.useState<'single' | 'complex'>('single');
  const [sessionStarted, setSessionStarted] = React.useState(false);
  const [bootKey, setBootKey] = React.useState(0);
  const [expertsOpen, setExpertsOpen] = React.useState(false);
  const [almostReady, setAlmostReady] = React.useState(false);
  const [councilPaywallOpen, setCouncilPaywallOpen] = React.useState(false);
  const modeRef = React.useRef(mode);
  modeRef.current = mode;
  const councilUnlockRef = React.useRef<CouncilUnlockMethod | null>(null);
  const councilPointsChargedRef = React.useRef(false);

  const buildBootstrapTurnBody = React.useCallback(() => {
    const currentMode = modeRef.current;
    return DecideInterviewTurnRequestSchema.parse({
      mode: currentMode,
      ...(currentMode === 'complex' && councilUnlockRef.current
        ? { councilUnlock: councilUnlockRef.current }
        : {}),
    });
  }, []);

  const refundCouncilIfCharged = React.useCallback(() => {
    if (councilPointsChargedRef.current) {
      refundCouncilPoints();
      councilPointsChargedRef.current = false;
    }
    councilUnlockRef.current = null;
  }, [refundCouncilPoints]);

  const activateCouncilMode = React.useCallback(
    (unlock: CouncilUnlockMethod) => {
      if (sessionStarted) return;
      if (unlock === 'points') {
        if (!unlockCouncilWithPoints()) {
          setCouncilPaywallOpen(true);
          return;
        }
        councilPointsChargedRef.current = true;
      }
      councilUnlockRef.current = unlock;
      setMode('complex');
      setSessionId(null);
      setMessages([]);
      setRecentJoinExpertIds(new Set());
      setExpertJoinRows([]);
      setFinalDecision(null);
      setFinalReady(false);
      setChoicePrompt(null);
      setSessionStarted(false);
      setCouncilPaywallOpen(false);
      setBootKey((k) => k + 1);
    },
    [sessionStarted, unlockCouncilWithPoints],
  );

  const trySelectCouncil = React.useCallback(() => {
    if (mode === 'complex' || sessionStarted) return;
    const unlock = resolveCouncilUnlock();
    if (unlock === 'premium') {
      activateCouncilMode('premium');
      return;
    }
    setCouncilPaywallOpen(true);
  }, [activateCouncilMode, mode, resolveCouncilUnlock, sessionStarted]);

  const handleModeChange = React.useCallback(
    (newMode: 'single' | 'complex') => {
      if (newMode === mode) return;
      if (sessionStarted) return;
      if (newMode === 'complex') {
        trySelectCouncil();
        return;
      }
      refundCouncilIfCharged();
      setMode('single');
      setSessionId(null);
      setMessages([]);
      setFinalDecision(null);
      setFinalReady(false);
      setChoicePrompt(null);
      setSessionStarted(false);
      setBootKey((k) => k + 1);
    },
    [mode, refundCouncilIfCharged, sessionStarted, trySelectCouncil],
  );

  const listRef = React.useRef<FlatList<DecideThreadItem>>(null);
  const followLatestRef = React.useRef(true);
  const lastChoicePromptIdRef = React.useRef<string | null>(null);
  const verdictAnim = React.useRef(new Animated.Value(0)).current;
  const [verdictExpanded, setVerdictExpanded] = React.useState(false);
  const choiceCardAnim = React.useRef(new Animated.Value(0)).current;
  const draftRef = React.useRef(draft);
  draftRef.current = draft;

  React.useEffect(() => {
    if (!finalReady || !finalDecision) {
      verdictAnim.stopAnimation();
      verdictAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(verdictAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(verdictAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [finalDecision, finalReady, verdictAnim]);

  React.useEffect(() => {
    if (!choicePrompt) {
      choiceCardAnim.setValue(0);
      return;
    }
    choiceCardAnim.setValue(0);
    Animated.spring(choiceCardAnim, {
      toValue: 1,
      friction: 8,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [choiceCardAnim, choicePrompt?.id]);

  React.useEffect(() => {
    if (!finalReady || !finalDecision) return;
    void Haptics.notificationAsync(
      /^(yes)\b/i.test(finalDecision.verdictLine.trim())
        ? Haptics.NotificationFeedbackType.Success
        : /^(no)\b/i.test(finalDecision.verdictLine.trim())
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
    ).catch(() => undefined);
  }, [finalDecision, finalReady]);

  React.useEffect(() => {
    if (!params.category) return;
    if (readable[params.category]) {
      updateDraft({ category: params.category });
    }
  }, [params.category, updateDraft]);

  const fetchSessionsIndex = React.useCallback(async () => {
    try {
      setListLoading(true);
      const raw = await apiGetJson<unknown>('/v1/harmence/interview/sessions');
      const parsed = DecideInterviewSessionsListSchema.parse(raw);
      setSessions(parsed.sessions);
    } catch {
      setSessions([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  const applyTurnPayload = React.useCallback(
    (payload: unknown) => {
      const parsed = DecideInterviewTurnResponseSchema.parse(payload);
      setSessionId(parsed.sessionId);
      if (parsed.mode) setMode(parsed.mode);
      setAlmostReady(parsed.almostReady ?? false);
      setHermesIntegrated(parsed.hermesIntegrated);
      setActiveExperts(parsed.activeExperts ?? []);
      const newlyJoined = parsed.newlyActivatedExperts ?? [];
      if (newlyJoined.length > 0) {
        setRecentJoinExpertIds(new Set(newlyJoined.map((expert) => expert.id)));
        if (modeRef.current === 'complex' && Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        }
      }
      setMessages((prev) => {
        let merged = mergeDeduped(prev, parsed.bubbles);
        if (parsed.choicePrompt) {
          const headline = choicePromptHeadline(parsed.choicePrompt);
          for (let i = merged.length - 1; i >= 0; i -= 1) {
            if (merged[i]?.role !== 'assistant') continue;
            merged = [
              ...merged.slice(0, i),
              {
                ...merged[i],
                question: parsed.choicePrompt.question,
                text: headline,
              },
              ...merged.slice(i + 1),
            ];
            break;
          }
        }
        if (newlyJoined.length > 0) {
          const lastUser = [...merged].filter((message) => message.role === 'user').at(-1);
          const anchorAt = joinAnchorAt(merged);
          const contextByExpertId = new Map(
            newlyJoined.map((expert) => [
              expert.id,
              joinContextForExpert(expert, parsed.choicePrompt ?? null, lastUser?.text),
            ]),
          );
          setExpertJoinRows((rows) => appendExpertJoinRows(rows, newlyJoined, anchorAt, contextByExpertId));
        }
        return merged;
      });
      setChoicePrompt(parsed.choicePrompt ?? null);
      setIsTypingCustomChoice(false);
      setCustomChoice('');
      setFinalReady(parsed.isComplete);
      setFinalDecision(parsed.finalDecision ?? null);
      if (parsed.finalDecision) setVerdictExpanded(false);

      if (parsed.isComplete && (parsed.suggestedDraftHints || parsed.previewCard || parsed.finalDecision)) {
        const h = parsed.suggestedDraftHints;
        const preview = parsed.previewCard;
        const fd = parsed.finalDecision;
        const d = draftRef.current;
        const pollOptions =
          preview?.options?.length && preview.options.length >= 2
            ? preview.options.map((option) => ({ id: option.id, label: option.label }))
            : d.pollOptions;
        updateDraft({
          category: h?.category ?? preview?.category ?? d.category,
          title: h?.title?.trim()?.length ? h.title.trim() : preview?.question?.trim() || d.title,
          constraints: h?.constraints?.trim()
            ? [d.constraints, h.constraints.trim()].filter(Boolean).join('\n\n')
            : d.constraints,
          successCriteria:
            h?.successCriteria?.trim()?.length ? h.successCriteria.trim() : d.successCriteria,
          communityChallengeQuestion:
            h?.communityChallengeQuestion?.trim()?.length
              ? h.communityChallengeQuestion.trim()
              : preview?.question?.trim() || d.communityChallengeQuestion,
          communityAiVerdictLine:
            h?.communityAiVerdictLine?.trim()?.length
              ? h.communityAiVerdictLine.trim()
              : preview?.aiVerdictLine?.trim() || fd?.verdictLine?.trim() || d.communityAiVerdictLine,
          communityAiBecause:
            h?.communityAiBecause?.trim()?.length
              ? h.communityAiBecause.trim()
              : preview?.aiBecause?.trim()
              || [fd?.recommendation, fd?.rationale].filter(Boolean).join('\n\n')
              || d.communityAiBecause,
          hook: preview?.hook?.trim() || d.hook,
          tension: preview?.tension?.trim() || d.tension,
          pollOptions,
          discussionPreview:
            preview?.discussionPreview?.length ? [...preview.discussionPreview] : d.discussionPreview,
          expertVerdicts: fd?.expertVerdicts ?? d.expertVerdicts,
          keyMoments: fd?.keyMoments ?? d.keyMoments,
          reflection: fd?.reflection ?? d.reflection,
          aiConfidenceScore: (() => {
            if (fd?.confidenceScore != null) {
              return fd.confidenceScore;
            }
            if (fd) {
              return ({ low: 35, medium: 60, high: 82 } as Record<string, number>)[fd.confidence] ?? 60;
            }
            return parsed.ambiguity != null ? Math.round((1 - parsed.ambiguity) * 100) : d.aiConfidenceScore;
          })(),
          decisionRecordId: parsed.decisionRecordId ?? d.decisionRecordId,
          decisionLens: parsed.decisionLens ?? d.decisionLens,
        });
      }

      return parsed;
    },
    [updateDraft],
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setBooting(true);
      setError(null);
      try {
        const payload = await apiPostJson('/v1/harmence/interview/turn', buildBootstrapTurnBody());
        if (!cancelled) {
          applyTurnPayload(payload);
          councilPointsChargedRef.current = false;
        }
      } catch (e) {
        if (!cancelled) {
          refundCouncilIfCharged();
          if (modeRef.current === 'complex') {
            setMode('single');
          }
          setError(userFacingApiError(e, 'ShouldI isn’t available right now. Please try again.'));
          setMessages([
            {
              id: 'assistant-offline',
              role: 'assistant',
              text: HARMENCE_OFFLINE_BUBBLE,
              at: Date.now(),
              supportingExpertIds: [],
            },
          ]);
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyTurnPayload, bootKey, buildBootstrapTurnBody, refundCouncilIfCharged]);

  const openPastSessions = () => {
    setSessionsOpen(true);
    void fetchSessionsIndex();
  };

  const activateSessionFromHistory = React.useCallback(async (sid: string) => {
    setSessionsOpen(false);
    setBooting(true);
    setError(null);
    try {
      const raw = await apiGetJson<unknown>(`/v1/harmence/interview/sessions/${encodeURIComponent(sid)}`);
      const detail = DecideInterviewSessionDetailSchema.parse(raw);
      setSessionId(detail.id);
      if (detail.mode) setMode(detail.mode);
      setAlmostReady(false);
      setHermesIntegrated(detail.hermesIntegrated);
      setActiveExperts(detail.activeExperts ?? []);
      setExpertJoinRows([]);
      setRecentJoinExpertIds(new Set());
      setMessages([...detail.bubbles].sort((a, b) => a.at - b.at));
      setChoicePrompt(detail.choicePrompt ?? null);
      lastChoicePromptIdRef.current = detail.choicePrompt?.id ?? null;
      followLatestRef.current = true;
      setIsTypingCustomChoice(false);
      setCustomChoice('');
      setFinalReady(detail.isComplete);
      setFinalDecision(detail.finalDecision ?? null);
      setVerdictExpanded(false);
      if (detail.isComplete && detail.finalDecision) {
        const fd = detail.finalDecision;
        const d = draftRef.current;
        updateDraft({
          expertVerdicts: fd.expertVerdicts ?? d.expertVerdicts,
          keyMoments: fd.keyMoments ?? d.keyMoments,
          reflection: fd.reflection ?? d.reflection,
          communityAiVerdictLine: fd.verdictLine?.trim() || d.communityAiVerdictLine,
          communityAiBecause:
            [fd.recommendation, fd.rationale].filter(Boolean).join('\n\n') || d.communityAiBecause,
          aiConfidenceScore:
            fd.confidenceScore ??
            ({ low: 35, medium: 60, high: 82 } as Record<string, number>)[fd.confidence] ??
            d.aiConfidenceScore,
        });
      }
      queueMicrotask(() => listRef.current?.scrollToEnd({ animated: false }));
    } catch (e) {
      setError(userFacingApiError(e, 'Could not reopen that chat. Please try again.'));
    } finally {
      setBooting(false);
    }
  }, [updateDraft]);

  const startFreshSession = React.useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setActiveExperts([]);
    setExpertJoinRows([]);
    setRecentJoinExpertIds(new Set());
    followLatestRef.current = true;
    lastChoicePromptIdRef.current = null;
    setChoicePrompt(null);
    setSessionStarted(false);
    setIsTypingCustomChoice(false);
    setCustomChoice('');
    setFinalReady(false);
    setFinalDecision(null);
    setVerdictExpanded(false);
    setError(null);
    refundCouncilIfCharged();
    setMode('single');
    setBootKey((k) => k + 1);
  }, [refundCouncilIfCharged]);

  const submitUserText = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!sessionId || !trimmed || sending) return;
      setSessionStarted(true);
      setSending(true);
      setError(null);
      followLatestRef.current = true;
      try {
        const payload = await apiPostJson(
          `/v1/harmence/interview/turn`,
          DecideInterviewTurnRequestSchema.parse({
            sessionId,
            userText: trimmed,
          }),
        );
        setInput('');
        applyTurnPayload(payload);
      } catch (e) {
        setError(userFacingApiError(e, 'Could not send your message. Please try again.'));
      } finally {
        setSending(false);
      }
    },
    [applyTurnPayload, sending, sessionId],
  );

  const handleSend = async () => {
    if (isTypingCustomChoice) {
      await handleCustomChoiceSubmit();
      return;
    }
    await submitUserText(input);
  };

  const handleChoiceSelect = async (option: DecideInterviewChoiceOption) => {
    if (!sessionId || !choicePrompt || sending) return;
    void Haptics.selectionAsync().catch(() => undefined);
    setSessionStarted(true);
    setSending(true);
    setError(null);
    followLatestRef.current = true;
    setIsTypingCustomChoice(false);
    setCustomChoice('');
    try {
      const payload = await apiPostJson(
        `/v1/harmence/interview/turn`,
        DecideInterviewTurnRequestSchema.parse({
          sessionId,
          selectedOptionId: option.id,
          userText: option.label,
        }),
      );
      applyTurnPayload(payload);
    } catch (e) {
      setError(userFacingApiError(e, 'Could not record your choice. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const handleCustomChoiceSubmit = async () => {
    const trimmed = customChoice.trim();
    if (!trimmed || !choicePrompt) return;
    await handleChoiceSelect({
      id: `custom-${Date.now()}`,
      label: trimmed,
    });
  };

  const hasUserMessages = messages.some((m) => m.role === 'user');
  const modeLocked = sessionStarted || hasUserMessages;
  const verdictText = finalDecision?.verdictLine ?? '';
  const verdictWord = React.useMemo(() => {
    const normalized = verdictText.trim().toLowerCase();
    if (normalized.startsWith('yes') || normalized.includes('lean yes')) return 'YES';
    if (normalized.startsWith('no') || normalized.includes('lean no')) return 'NO';
    return 'DECIDE';
  }, [verdictText]);
  const verdictScale = verdictAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });
  const verdictHalo = verdictAnim.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0.62] });

  const expertMap = React.useMemo(() => {
    const map = new Map<string, DecideInterviewExpert>();
    for (const expert of activeExperts) map.set(expert.id, expert);
    return map;
  }, [activeExperts]);
  const primaryExpert = choicePrompt?.speakerExpertId
    ? expertMap.get(choicePrompt.speakerExpertId)
    : activeExperts[0];
  const sessionExperts = React.useMemo(() => {
    if (activeExperts.length > 0) return activeExperts;
    if (primaryExpert) return [primaryExpert];
    return [];
  }, [activeExperts, primaryExpert]);
  const isCouncil = mode === 'complex';
  const councilTheme = React.useMemo(
    () => ({
      violet: council.violet,
      gold: council.gold,
      headerGrad: (isDark ? COUNCIL_GRADIENT_DARK : COUNCIL_GRADIENT_LIGHT) as readonly [string, string, string],
      verdictGrad: (isDark
        ? ['#0f172a', '#1f2937', '#0b1220']
        : ['#eef2ff', '#f8fafc', '#e0e7ff']) as readonly [string, string, string],
      accent: isCouncil ? council.violet : chrom.mint,
    }),
    [chrom.mint, isCouncil, isDark],
  );
  const councilTally = finalDecision ? councilVoteTally(finalDecision.expertVerdicts) : null;
  const progressText = choicePrompt?.progress
    ? choicePrompt.progress.ambiguity !== undefined
      ? `Clarity ${Math.round((1 - choicePrompt.progress.ambiguity) * 100)}%`
      : choicePrompt.progress.mode === 'adaptive' || !choicePrompt.progress.total
        ? `Check ${choicePrompt.progress.checked + 1} · adaptive`
        : `${choicePrompt.progress.checked}/${choicePrompt.progress.total} ${choicePrompt.progress.label ?? 'checks'}`
    : null;
  const sessionClarityPercent = React.useMemo(() => {
    if (!choicePrompt?.progress) return null;
    return Math.round(progressRatio(choicePrompt.progress) * 100);
  }, [choicePrompt?.progress]);
  const sessionProgressCaption = React.useMemo(() => {
    const progress = choicePrompt?.progress;
    if (!progress || progress.ambiguity !== undefined) return null;
    if (progress.mode === 'adaptive' || !progress.total) {
      return `Check ${progress.checked + 1}`;
    }
    return `${progress.checked}/${progress.total}${progress.label ? ` ${progress.label}` : ''}`;
  }, [choicePrompt?.progress]);
  const showStarterPrompts =
    !booting && !choicePrompt && !finalReady && !sending && !!sessionId && messages.length <= 1;
  const verdictAccent =
    isCouncil && verdictWord === 'YES'
      ? palette.mint
      : isCouncil && verdictWord === 'NO'
        ? palette.danger
        : isCouncil
          ? council.violet
          : verdictWord === 'YES'
            ? chrom.mint
            : verdictWord === 'NO'
              ? palette.playful
              : chrom.sky;
  const choiceCardTranslate = choiceCardAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const expertForBubble = React.useCallback(
    (item: DecideInterviewBubble): DecideInterviewExpert | null => {
      if (!item.expertId) return null;
      return (
        expertMap.get(item.expertId) ?? {
          id: item.expertId,
          title: item.expertTitle ?? 'Decision expert',
          skillName: item.expertTitle ?? item.expertId,
          icon: item.expertIcon ?? 'sparkles-outline',
          color: item.expertColor ?? semantic.actionPrimary,
        }
      );
    },
    [expertMap],
  );

  const bottomPad = Math.max(insets.bottom, 10);
  /** On Decide tab the center button is inline with other tabs. */
  const tabFabClearance = Platform.select({ ios: 12, android: 10, default: 8 }) ?? 8;
  const activeChoiceMessageIndex = React.useMemo(() => {
    if (!choicePrompt || finalReady || isTypingCustomChoice) return -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'assistant') return i;
    }
    return -1;
  }, [choicePrompt, finalReady, isTypingCustomChoice, messages]);
  const showCompactHeader = modeLocked || sessionStarted || hasUserMessages;
  const showSessionStatus =
    showCompactHeader &&
    !finalReady &&
    !booting &&
    (sessionClarityPercent !== null || sessionExperts.length > 0 || isCouncil);
  const headerSubtitle = React.useMemo(() => {
    if (!showCompactHeader) return 'Ask one decision. Get a clear recommendation.';
    if (isCouncil) {
      const expertPart =
        activeExperts.length > 0
          ? `${activeExperts.length} expert${activeExperts.length === 1 ? '' : 's'}`
          : 'Assembling council';
      return progressText ? `${expertPart} · ${progressText}` : expertPart;
    }
    if (primaryExpert?.title) {
      return progressText ? `${primaryExpert.title} · ${progressText}` : primaryExpert.title;
    }
    return progressText ?? choicePrompt?.specialistLabel ?? 'In progress';
  }, [
    activeExperts.length,
    choicePrompt?.specialistLabel,
    isCouncil,
    primaryExpert?.title,
    progressText,
    showCompactHeader,
  ]);
  const canOpenExpertRoster = sessionExperts.length > 0;
  const resolveThreadExpert = React.useCallback(
    (bubble: DecideInterviewBubble) => expertForBubble(bubble),
    [expertForBubble],
  );
  const threadItems = React.useMemo(
    () => buildThreadItems(messages, expertJoinRows),
    [expertJoinRows, messages],
  );
  const showFooterChoiceEyebrow = React.useMemo(() => {
    if (!primaryExpert?.title?.trim()) return false;
    const lastItem = threadItems.at(-1);
    if (
      lastItem?.kind === 'expert-join' &&
      lastItem.expert.title?.trim().toLowerCase() === primaryExpert.title.trim().toLowerCase()
    ) {
      return false;
    }
    const lastMessage = [...threadItems].reverse().find((item) => item.kind === 'message');
    if (!lastMessage) return true;
    return threadSenderLabel(lastMessage, resolveThreadExpert) !== primaryExpert.title.trim();
  }, [primaryExpert?.title, resolveThreadExpert, threadItems]);

  const scrollToActiveQuestion = React.useCallback((animated = true) => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated });
    }, 140);
  }, []);

  const handleListScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    followLatestRef.current = distanceFromBottom <= 120;
  }, []);

  React.useEffect(() => {
    if (!choicePrompt || finalReady || booting || sending) return;
    if (choicePrompt.id === lastChoicePromptIdRef.current) return;
    lastChoicePromptIdRef.current = choicePrompt.id;
    if (!followLatestRef.current) return;
    scrollToActiveQuestion(true);
  }, [booting, choicePrompt?.id, finalReady, scrollToActiveQuestion, sending]);

  React.useEffect(() => {
    if (recentJoinExpertIds.size === 0) return;
    const timer = setTimeout(() => setRecentJoinExpertIds(new Set()), 2400);
    return () => clearTimeout(timer);
  }, [recentJoinExpertIds]);

  const showStarterLaunchPad = showStarterPrompts;
  const showComposer = !finalReady && (!choicePrompt || isTypingCustomChoice);
  const showAnswerPane =
    !finalReady && (showComposer || showStarterLaunchPad || isTypingCustomChoice);
  const councilSummary = finalDecision ? expertCouncilSummary(finalDecision.expertVerdicts) : null;
  const canExpandVerdict = !!(
    finalDecision &&
    (finalDecision.rationale?.trim() ||
      finalDecision.nextSteps.length > 0 ||
      finalDecision.expertVerdicts.length > 0 ||
      finalDecision.reflection?.summary)
  );

  const choiceWhyItMatters = React.useMemo(() => choicePrompt?.whyItMatters?.trim() || null, [choicePrompt]);
  const choiceHelperNote = React.useMemo(() => choicePrompt?.helperText?.trim() || null, [choicePrompt]);

  const renderChoiceOptionsList = () => {
    if (!choicePrompt || finalReady || isTypingCustomChoice || sending) return null;

    const optionCount = choicePrompt.options.length + (choicePrompt.allowCustomAnswer ? 1 : 0);

    return (
      <View style={[styles.choiceOptionList, { borderTopColor: colors.cardBorder }]}>
        {choicePrompt.options.map((option, index) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={`Select ${option.label}`}
            disabled={sending}
            onPress={() => {
              void handleChoiceSelect(option);
            }}
            style={({ pressed }) => [
              styles.choiceOptionRow,
              index < optionCount - 1 && [styles.choiceOptionRowDivider, { borderBottomColor: colors.cardBorder }],
              pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)' },
            ]}>
            <Text style={[styles.choiceOptionLabel, { color: colors.primaryTxt }]}>{option.label}</Text>
            {option.description?.trim() ? (
              <Text style={[styles.choiceOptionDesc, { color: colors.muted }]} numberOfLines={1}>
              {option.description}
            </Text>
            ) : null}
          </Pressable>
        ))}
        {choicePrompt.allowCustomAnswer ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Type another answer"
            disabled={sending}
            onPress={() => setIsTypingCustomChoice(true)}
            style={({ pressed }) => [
              styles.choiceOptionRow,
              pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)' },
            ]}>
            <Text style={[styles.choiceOptionLabel, { color: colors.muted }]}>Other — type my own answer</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderActiveChoiceBlock = (
    questionText: string,
    expertTitle?: string | null,
    showSenderEyebrow = true,
  ) => {
    if (!choicePrompt || finalReady || isTypingCustomChoice || sending) return null;

    return (
      <Animated.View
        style={[
          styles.threadBlock,
          styles.msgPadH,
          { opacity: choiceCardAnim, transform: [{ translateY: choiceCardTranslate }] },
        ]}>
        {expertTitle && showSenderEyebrow ? (
          <Text style={[styles.threadEyebrow, { color: colors.muted }]}>{formatSenderDisplay(expertTitle)}</Text>
        ) : null}
        <View
          style={[
            styles.activeChoiceCard,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.cardBorder,
            },
          ]}>
          <View style={styles.activeChoiceQuestion}>
            <Text selectable style={[styles.choiceQuestionText, { color: colors.primaryTxt }]}>
              {questionText}
            </Text>
            {almostReady ? (
              <Text style={[styles.almostReadyHint, { color: colors.muted }]}>Almost ready — one or two more answers.</Text>
            ) : null}
            {choiceWhyItMatters ? (
              <View
                accessibilityRole="text"
                accessibilityLabel={`Why this matters. ${choiceWhyItMatters}`}
                style={[
                  styles.whyCard,
                  {
                    backgroundColor: isDark ? 'rgba(95,169,149,0.08)' : `${semantic.actionAffirm}10`,
                    borderColor: isDark ? 'rgba(95,169,149,0.22)' : `${semantic.actionAffirm}30`,
                  },
                ]}>
                <Text style={[styles.whyLabel, { color: semantic.actionAffirm }]}>Why this matters</Text>
                <Text style={[styles.whyText, { color: colors.primaryTxt }]} numberOfLines={4}>
                  {choiceWhyItMatters}
                </Text>
              </View>
            ) : null}
            {choiceHelperNote ? (
              <Text style={[styles.choiceNote, { color: colors.muted }]} numberOfLines={3}>
                {choiceHelperNote}
              </Text>
            ) : null}
          </View>
          {renderChoiceOptionsList()}
        </View>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top + 10, 28),
          },
        ]}>
        <TabScreenHeader
          title="Decide"
          subtitle={showSessionStatus ? undefined : headerSubtitle}
          textDisplay={colors.displayTxt}
          textMuted={colors.muted}
          groupedSurface={colors.cardBg}
          hairline={colors.headerHairline}
          textPrimary={colors.primaryTxt}
          action={
            <View style={tabScreenStyles.headerActionRow}>
              <TabHeaderIconButton
                icon="time-outline"
                accessibilityLabel="Past sessions"
                onPress={openPastSessions}
                groupedSurface={colors.cardBg}
                hairline={colors.headerHairline}
                iconColor={colors.muted}
                iconSize={22}
              />
              <TabHeaderIconButton
                icon="create-outline"
                accessibilityLabel="New chat"
                onPress={startFreshSession}
                disabled={booting || sending}
                groupedSurface={colors.cardBg}
                hairline={colors.headerHairline}
                iconColor={colors.muted}
                iconSize={22}
              />
            </View>
          }>
          {showSessionStatus ? (
            <View
              style={[
                styles.sessionStatusShell,
                { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
              ]}>
              <DecideSessionStatus
                clarityPercent={sessionClarityPercent}
                progressCaption={sessionProgressCaption}
                experts={sessionExperts}
                isCouncil={isCouncil}
                colors={colors}
                onPressExperts={canOpenExpertRoster ? () => setExpertsOpen(true) : undefined}
              />
            </View>
          ) : null}
          {!modeLocked && !booting && !finalReady ? (
            <DecideModeSegment
              mode={mode}
              isDark={isDark}
              isPremium={isPremium}
              canAccessCouncil={canAccessCouncil}
              councilSessionCost={councilSessionCost}
              onSelectSingle={() => handleModeChange('single')}
              onSelectCouncil={trySelectCouncil}
            />
          ) : null}
        </TabScreenHeader>
      </View>

      {booting ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={semantic.actionPrimary} size="large" />
          <Text style={[styles.loadingLabel, { color: colors.muted }]}>Loading…</Text>
        </View>
      ) : finalReady && finalDecision ? (
        <View style={[styles.verdictScreen, { backgroundColor: colors.pageBg }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.verdictScrollContent}>
          <Text style={[styles.verdictEyebrow, { color: colors.muted }]}>
            {isCouncil ? 'Council recommendation' : 'Recommendation'}
          </Text>
          <Text style={[styles.verdictWordHeadline, { color: colors.displayTxt }]}>{verdictWord}</Text>
          <Text style={[styles.verdictSentence, { color: colors.primaryTxt }]}>
            {finalDecision.verdictLine}
          </Text>
          <View style={[styles.verdictCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Text style={[styles.verdictCardLabel, { color: colors.muted }]}>Recommendation</Text>
            <Text
              style={[styles.verdictReason, { color: colors.primaryTxt }]}
              numberOfLines={verdictExpanded ? undefined : 4}>
              {finalDecision.recommendation}
            </Text>
          </View>
          {isCouncil && councilTally && councilTally.total > 0 ? (
            <CouncilVoteTally yes={councilTally.yes} no={councilTally.no} total={councilTally.total} isDark={isDark} />
          ) : councilSummary ? (
            <Text style={[styles.verdictCouncilSummary, { color: colors.muted }]}>{councilSummary}</Text>
          ) : null}
          {finalDecision.rationale?.trim() ? (
            <View style={[styles.verdictCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <Text style={[styles.verdictCardLabel, { color: colors.muted }]}>Why</Text>
              <Text
                style={[styles.verdictRationale, { color: colors.primaryTxt }]}
                numberOfLines={verdictExpanded ? undefined : 4}>
                {finalDecision.rationale}
              </Text>
            </View>
          ) : null}
          {verdictExpanded && finalDecision.expertVerdicts.length > 0 ? (
            <View style={styles.expertVerdictsWrap}>
              <Text style={[styles.verdictCardLabel, { color: colors.muted }]}>Individual votes</Text>
              {finalDecision.expertVerdicts.map((verdict) => {
                const expert = expertMap.get(verdict.expertId);
                const stamp = councilVoteStamp(verdict.verdictLine);
                const stampColor =
                  stamp === 'YES'
                    ? semantic.actionAffirm
                    : stamp === 'NO'
                      ? palette.danger
                      : semantic.actionPrimary;
                return (
                  <View
                    key={verdict.expertId}
                    style={[
                      styles.expertVerdictCard,
                      {
                        borderColor: colors.cardBorder,
                        backgroundColor: colors.cardBg,
                      },
                    ]}>
                    <View style={[styles.expertVerdictAccent, { backgroundColor: expert?.color ?? semantic.actionPrimary }]} />
                    <View style={styles.expertVerdictCardBody}>
                      <View style={styles.expertVerdictHead}>
                        <ExpertGlyph expert={expert} fallbackColor={semantic.actionPrimary} size={28} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.expertVerdictTitle, { color: colors.primaryTxt }]}>
                            {verdict.expertTitle}
                          </Text>
                          <Text style={[styles.expertVerdictLine, { color: colors.muted }]}>
                            {verdict.verdictLine}
                          </Text>
                        </View>
                        <View style={[styles.voteStamp, { backgroundColor: `${stampColor}22`, borderColor: `${stampColor}55` }]}>
                          <Text style={[styles.voteStampText, { color: stampColor }]}>{stamp}</Text>
                        </View>
                      </View>
                      <Text style={[styles.expertVerdictConfidence, { color: colors.muted }]}>
                        Confidence · {verdict.confidence}
                      </Text>
                      <Text style={[styles.expertVerdictReason, { color: colors.muted }]}>{verdict.reasoning}</Text>
                      {verdict.risks.length > 0 ? (
                        <Text style={[styles.expertVerdictMeta, { color: colors.muted }]}>
                          Risks: {verdict.risks.join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
          {finalDecision.reflection?.summary ? (
            <View style={[styles.verdictCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
              <Text style={[styles.verdictCardLabel, { color: colors.muted }]}>What to watch</Text>
              <Text style={[styles.reflectionBody, { color: colors.primaryTxt }]}>{finalDecision.reflection.summary}</Text>
              {finalDecision.reflection.concerns?.map((concern) => (
                <Text key={concern} style={[styles.reflectionConcern, { color: colors.muted }]}>
                  · {concern}
                </Text>
              ))}
            </View>
          ) : null}
          {finalDecision.nextSteps.length > 0 ? (
            <View style={[styles.verdictCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
              <Text style={[styles.verdictCardLabel, { color: colors.muted }]}>Next steps</Text>
              {finalDecision.nextSteps.map((step) => (
                <View key={step} style={styles.verdictStepRow}>
                  <View style={[styles.verdictStepDot, { backgroundColor: semantic.actionPrimary }]} />
                  <Text style={[styles.verdictStepText, { color: colors.primaryTxt }]}>{step}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {canExpandVerdict ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={verdictExpanded ? 'Show less detail' : 'See full reasoning'}
              onPress={() => setVerdictExpanded((v) => !v)}
              style={styles.verdictExpandBtn}>
              <Text style={[styles.verdictExpandText, { color: semantic.actionPrimary }]}>
                {verdictExpanded
                  ? 'Show less'
                  : finalDecision.expertVerdicts.length > 0
                    ? 'See how each expert voted'
                    : 'See full reasoning'}
              </Text>
              <Ionicons
                name={verdictExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={semantic.actionPrimary}
              />
            </Pressable>
          ) : null}
          <View style={styles.verdictActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ask the community to validate your recommendation"
              onPress={() => router.push('/(tabs)/decide/confirm')}
              style={ctaStyles.primary}>
              <Text style={ctaStyles.primaryLabel}>Ask the community</Text>
              <Ionicons name="arrow-forward" size={18} color={palette.sheet} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start a new decision"
              onPress={startFreshSession}
              style={[styles.verdictSecondary, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
              <Text style={[styles.verdictSecondaryText, { color: colors.primaryTxt }]}>Ask another</Text>
            </Pressable>
          </View>
          </ScrollView>
        </View>
      ) : (
        <View style={styles.interactionShell}>
        <FlatList
          ref={listRef}
          data={threadItems}
          keyExtractor={threadItemKey}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            {
              flexGrow: 1,
              paddingBottom:
                choicePrompt && !finalReady && !isTypingCustomChoice
                  ? bottomPad + tabFabClearance + spacing.xl
                  : showAnswerPane
                    ? spacing.sm
                    : bottomPad + tabFabClearance,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          onScroll={handleListScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={null}
          ListFooterComponent={
            <>
              {sending ? (
                <ThinkingRow
                  label={isCouncil ? 'Council is reviewing...' : 'ShouldI is reviewing...'}
                  accent={semantic.actionPrimary}
                  muted={colors.muted}
                />
              ) : null}
              {choicePrompt && !finalReady && !isTypingCustomChoice && activeChoiceMessageIndex === -1
                ? renderActiveChoiceBlock(
                    choicePromptHeadline(choicePrompt),
                    primaryExpert?.title,
                    showFooterChoiceEyebrow,
                  )
                : null}
            </>
          }
          renderItem={({ item, index }) => {
            if (item.kind === 'expert-join') {
              return (
                <ChamberJoinChatRow
                  expert={item.expert}
                  contextText={item.contextText}
                  isCouncil={isCouncil}
                  isDark={isDark}
                  colors={colors}
                />
              );
            }

            const bubble = item.bubble;
            const messageIndex = item.messageIndex;
            const bubbleExpert = expertForBubble(bubble);
            const senderLabel = threadSenderLabel(item, resolveThreadExpert);
            const showSenderEyebrow = shouldShowThreadSenderEyebrow(index, threadItems, resolveThreadExpert);

            return bubble.role === 'assistant' ? (
              messageIndex === activeChoiceMessageIndex ? (
                renderActiveChoiceBlock(
                  assistantBubbleBody(bubble, messages, choicePrompt, true),
                  bubbleExpert?.title,
                  showSenderEyebrow,
                )
              ) : (
                <View style={[styles.threadBlock, styles.msgPadH]}>
                  {senderLabel && showSenderEyebrow ? (
                    <Text style={[styles.threadEyebrow, { color: colors.muted }]}>
                      {formatSenderDisplay(senderLabel)}
                    </Text>
                  ) : null}
                  <View
                    style={[
                      styles.threadCard,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.cardBorder,
                      },
                    ]}>
                    <Text selectable style={[styles.threadBody, { color: colors.primaryTxt }]}>
                      {assistantBubbleBody(bubble, messages, choicePrompt, false)}
                    </Text>
                  </View>
                </View>
              )
            ) : (
              <View style={[styles.userThreadBlock, styles.msgPadH]}>
                {senderLabel && showSenderEyebrow ? (
                  <Text style={[styles.threadEyebrow, styles.threadEyebrowUser, { color: colors.muted }]}>
                    {formatSenderDisplay(senderLabel)}
                  </Text>
                ) : null}
                <View style={[styles.userThreadCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                  <Text selectable style={[styles.threadBody, { color: colors.primaryTxt }]}>
                    {bubble.text}
                  </Text>
                </View>
              </View>
            );
          }}
        />

      {error ? (
        <View
          style={[
            styles.errorBanner,
            styles.msgPadH,
            {
              marginBottom: 6,
              backgroundColor: colors.composerBg,
              borderColor: colors.composerBorder,
            },
          ]}>
          <Ionicons name="alert-circle-outline" size={18} color={palette.playful} style={{ marginTop: 2 }} />
          <Text style={[styles.errorBannerTxt, { color: colors.primaryTxt }]}>{error}</Text>
        </View>
      ) : null}

      {!finalReady && showAnswerPane ? (
      <View
          style={[
            styles.answerPane,
            {
              backgroundColor: colors.pageBg,
              borderTopColor: colors.headerHairline,
            },
          ]}>
        {showStarterLaunchPad ? (
          <View style={[styles.launchPad, styles.msgPadH]}>
            {isCouncil ? (
              <View style={[styles.councilLaunchCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
                <View style={styles.councilLaunchInner}>
                  <Ionicons name="people-circle" size={20} color={colors.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.councilLaunchTitle, { color: colors.primaryTxt }]}>
                      {isPremium ? 'Expert Council' : 'Expert Council'}
                    </Text>
                    <Text style={[styles.councilLaunchSub, { color: colors.muted }]}>
                      {isPremium
                        ? 'Multiple specialists review your case. You see each vote at the end.'
                        : `${councilSessionCost} points per session. You see each vote at the end.`}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
            <Text style={[styles.launchPadLabel, { color: colors.muted }]}>Start with</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.launchPadScroll}>
              {STARTER_CHIPS.map((chip) => (
                <Pressable
                  key={chip.prompt}
                  accessibilityRole="button"
                  accessibilityLabel={`Ask: ${chip.prompt}`}
                  onPress={() => {
                    void submitUserText(chip.prompt);
                  }}
                  style={[
                    styles.launchChip,
                    {
                      borderColor: colors.cardBorder,
                      backgroundColor: colors.pageBg,
                    },
                  ]}>
                  <Text style={[styles.launchChipText, { color: colors.primaryTxt }]}>
                    {chip.short}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {showComposer ? (
          <View
            style={[
              styles.composerShell,
              {
                marginHorizontal: screenContentGutter,
                borderColor: colors.composerBorder,
                backgroundColor: colors.composerBg,
              },
            ]}>
            <TextInput
              value={isTypingCustomChoice ? customChoice : input}
              onChangeText={isTypingCustomChoice ? setCustomChoice : setInput}
              placeholder={
                isTypingCustomChoice
                  ? 'Type your answer...'
                  : booting
                    ? 'Connecting…'
                    : messages.length <= 1
                      ? 'e.g. Should I accept this co-op offer?'
                      : 'Add context...'
              }
              placeholderTextColor={colors.muted}
              editable={!booting && !sending && !!sessionId}
              autoFocus={isTypingCustomChoice}
              style={[styles.composerInput, { color: colors.primaryTxt }]}
              multiline
              maxFontSizeMultiplier={Platform.OS === 'ios' ? 1.35 : undefined}
            />
            {isTypingCustomChoice ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel custom answer"
                onPress={() => {
                  setIsTypingCustomChoice(false);
                  setCustomChoice('');
                }}
                style={styles.customChoiceCancelBtn}>
                <Ionicons name="close" size={16} color={colors.muted} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isTypingCustomChoice ? 'Send custom answer' : 'Send message'}
              onPress={() => {
                void handleSend();
              }}
              disabled={
                isTypingCustomChoice
                  ? !customChoice.trim() || sending
                  : !input.trim() || booting || !sessionId || sending
              }
              style={[
                styles.sendCircle,
                { backgroundColor: colors.sendFab },
                (isTypingCustomChoice
                  ? !customChoice.trim() || sending
                  : !input.trim() || booting || !sessionId || sending) && styles.sendCircleDisabled,
              ]}>
              {sending ? (
                <ActivityIndicator color={palette.white} size="small" />
              ) : (
                <Ionicons name="paper-plane-outline" size={17} color={palette.white} />
              )}
            </Pressable>
          </View>
        ) : null}
        </View>
      ) : null}
        </View>
      )}

      <DecideSessionsSheet
        visible={sessionsOpen}
        onClose={() => setSessionsOpen(false)}
        backgroundColor={colors.modalBg}
        borderTopColor={colors.composerBorder}
        bottomInset={bottomPad}
        grabColor={isDark ? profileNeutralStroke(0.38) : profileNeutralStroke(0.22)}
        listLoading={listLoading}
        sessions={sessions}
        primaryTxt={colors.primaryTxt}
        muted={colors.muted}
        composerBorder={colors.composerBorder}
        composerBg={colors.composerBg}
        accentColor={semantic.actionPrimary}
        onActivateSession={activateSessionFromHistory}
      />

      <ExpertRosterSheet
        visible={expertsOpen}
        onClose={() => setExpertsOpen(false)}
        backgroundColor={colors.modalBg}
        borderTopColor={colors.composerBorder}
        bottomInset={bottomPad}
        grabColor={isDark ? profileNeutralStroke(0.38) : profileNeutralStroke(0.22)}
        isCouncil={isCouncil}
        isDark={isDark}
        primaryTxt={colors.primaryTxt}
        muted={colors.muted}
        composerBorder={colors.composerBorder}
        accentColor={semantic.actionPrimary}
        activeExperts={activeExperts}
      />

      <CouncilPaywallSheet
        visible={councilPaywallOpen}
        onClose={() => setCouncilPaywallOpen(false)}
        bottomInset={bottomPad}
        grabColor={isDark ? profileNeutralStroke(0.38) : profileNeutralStroke(0.22)}
        isDark={isDark}
        primaryTxt={colors.primaryTxt}
        muted={colors.muted}
        entitlementsHydrated={entitlementsHydrated}
        pointsBalance={pointsBalance}
        councilSessionCost={councilSessionCost}
        canUseCouncilWithPoints={canUseCouncilWithPoints}
        onActivateCouncilMode={activateCouncilMode}
        grantDevPoints={grantDevPoints}
        activatePremium={activatePremium}
      />

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'column',
    gap: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenContentGutter,
    paddingBottom: 8,
    gap: 4,
    minHeight: 56,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtnGhost: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerExploreRow: {
    gap: 8,
    paddingHorizontal: screenContentGutter,
    paddingBottom: 14,
  },
  headerTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  headerTitleExplore: {
    ...typography.hero,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.8,
    fontWeight: '800',
  },
  headerSubtitleExplore: {
    ...typography.compact,
    lineHeight: 20,
    marginTop: 2,
    flex: 1,
  },
  headerSubtitlePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  sessionStatusShell: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  headerTitleBlock: {
    alignItems: 'center',
    gap: 2,
    marginBottom: 6,
  },
  headerTitle: {
    ...typography.titleSm,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    ...typography.caption,
    lineHeight: 17,
    textAlign: 'center',
  },
  headerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerStatusAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerStatusAvatarOverlap: {
    marginLeft: -6,
  },
  headerStatusText: {
    flexShrink: 1,
    ...typography.caption,
    fontWeight: '600',
    lineHeight: 16,
  },
  headerProgressEdge: {
    height: 3,
    width: '100%',
    overflow: 'hidden',
  },
  headerProgressEdgeFill: {
    height: '100%',
    borderRadius: 999,
  },
  headerModeSegmentWrap: {
    marginTop: 0,
  },
  headerExperts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 6,
  },
  headerExpertsCouncil: {
    gap: 0,
  },
  headerExpertOverlap: {
    marginLeft: -8,
  },
  expertOverflow: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  expertOverflowText: {
    ...typography.micro,
    fontWeight: '800',
  },
  headerProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  headerProgressTrack: {
    width: 120,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  headerProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  headerProgressLabel: {
    ...typography.label,
    fontWeight: '700',
    minWidth: 72,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
  },
  loadingLabel: {
    ...typography.compact,
    fontWeight: '500',
  },
  verdictScreen: {
    flex: 1,
  },
  verdictScrollContent: {
    flexGrow: 1,
    paddingHorizontal: screenContentGutter,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 12,
  },
  verdictEyebrow: {
    ...typography.micro,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  verdictWordHeadline: {
    ...typography.hero,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  verdictCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    shadowColor: '#0b1224',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  verdictCardLabel: {
    ...typography.micro,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  verdictSentence: {
    ...typography.titleSm,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  verdictSectionLabel: {
    marginTop: 12,
    ...typography.micro,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  verdictCouncilSummary: {
    marginTop: 10,
    ...typography.compact,
    fontWeight: '600',
    textAlign: 'center',
  },
  verdictReason: {
    ...typography.compact,
    lineHeight: 21,
    fontWeight: '500',
  },
  verdictRationale: {
    ...typography.compact,
    lineHeight: 21,
    fontWeight: '500',
  },
  expertVerdictsWrap: {
    width: '100%',
    maxWidth: 380,
    marginTop: 16,
    gap: 10,
  },
  expertVerdictCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  expertVerdictCardCouncil: {},
  expertVerdictAccent: {
    width: 4,
  },
  expertVerdictCardBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  councilSectionLabel: {
    ...typography.label,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 4,
  },
  voteStamp: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 44,
    alignItems: 'center',
  },
  voteStampText: {
    ...typography.label,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  expertVerdictHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expertVerdictTitle: {
    ...typography.subhead,
    fontWeight: '800',
  },
  expertVerdictLine: {
    marginTop: 2,
    ...typography.subhead,
    fontWeight: '800',
  },
  expertVerdictReason: {
    ...typography.subhead,
    lineHeight: 19,
    fontWeight: '500',
  },
  expertVerdictConfidence: {
    marginTop: 2,
    ...typography.label,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  expertVerdictMeta: {
    ...typography.caption,
    lineHeight: 17,
    fontWeight: '500',
  },
  reflectionCard: {
    width: '100%',
    maxWidth: 380,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  reflectionTitle: {
    ...typography.caption,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  reflectionBody: {
    ...typography.compact,
    lineHeight: 21,
    fontWeight: '600',
  },
  reflectionConcern: {
    ...typography.subhead,
    lineHeight: 19,
    fontWeight: '500',
  },
  verdictSteps: {
    marginTop: 16,
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  verdictStepsTitle: {
    ...typography.subhead,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  verdictStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  verdictStepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  verdictStepText: {
    flex: 1,
    ...typography.compact,
    fontWeight: '500',
  },
  verdictExpandBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  verdictExpandText: {
    ...typography.compact,
    fontWeight: '700',
  },
  verdictActions: {
    width: '100%',
    marginTop: 16,
    gap: 10,
  },
  verdictPrimary: {
    minHeight: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  verdictPrimaryText: {
    ...typography.body,
    fontWeight: '800',
  },
  verdictSecondary: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  verdictSecondaryText: {
    ...typography.bodySm,
    fontWeight: '700',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  interactionShell: {
    flex: 1,
    minHeight: 0,
  },
  answerPane: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    flexShrink: 0,
  },
  launchPad: {
    gap: 8,
  },
  councilHint: {
    ...typography.subhead,
    fontWeight: '500',
    marginBottom: 2,
  },
  councilLaunchCard: {
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  councilLaunchInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  councilLaunchTitle: {
    ...typography.compact,
    fontWeight: '800',
    lineHeight: 18,
  },
  councilLaunchSub: {
    marginTop: 3,
    ...typography.caption,
    lineHeight: 17,
    fontWeight: '500',
  },
  launchPadLabel: {
    ...typography.label,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  launchPadScroll: {
    gap: 8,
    paddingRight: screenContentGutter,
  },
  launchChip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  launchChipText: {
    ...typography.compact,
    fontWeight: '600',
    lineHeight: 18,
  },
  listContent: {
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
    gap: 10,
  },
  threadBlock: {
    marginBottom: 14,
    gap: 4,
  },
  threadEyebrow: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.1,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  threadEyebrowUser: {
    alignSelf: 'flex-end',
  },
  threadCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  threadCardActive: {
    borderWidth: 1,
  },
  threadBody: {
    ...typography.compact,
    lineHeight: 21,
    fontWeight: '500',
  },
  userThreadBlock: {
    marginBottom: 10,
    alignItems: 'flex-end',
    gap: 0,
  },
  userThreadCard: {
    maxWidth: '92%',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionRow: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  optionRowPressed: {
    opacity: 0.9,
    backgroundColor: 'rgba(79,118,194,0.06)',
  },
  optionRowOther: {
    minHeight: 44,
  },
  optionRowLabel: {
    ...typography.compact,
    fontWeight: '700',
  },
  optionRowDesc: {
    ...typography.caption,
    fontWeight: '500',
    lineHeight: 17,
  },
  msgPadH: {
    paddingHorizontal: screenContentGutter,
  },
  rowAssistant: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 10,
  },
  assistantLeading: {
    paddingTop: 2,
    alignItems: 'center',
  },
  supportingStack: {
    marginTop: -4,
    gap: 2,
  },
  glyphCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  assistantBubble: {
    flex: 1,
    maxWidth: '100%',
    borderRadius: 16,
    borderTopLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: StyleSheet.hairlineWidth,
  },
  assistantBubbleActive: {
    borderWidth: 1,
  },
  activeChoiceCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  activeChoiceQuestion: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  choiceQuestionText: {
    ...typography.compact,
    lineHeight: 22,
    fontWeight: '600',
  },
  choiceNote: {
    ...typography.caption,
    fontWeight: '500',
    lineHeight: 16,
    fontSize: 12,
  },
  choiceOptionList: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  choiceOptionRow: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 1,
  },
  choiceOptionRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  choiceOptionLabel: {
    ...typography.compact,
    fontWeight: '600',
    lineHeight: 17,
  },
  choiceOptionDesc: {
    ...typography.caption,
    fontWeight: '500',
    lineHeight: 15,
    fontSize: 12,
  },
  choicePanel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
    marginTop: 8,
    shadowColor: '#0b1224',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  councilChoiceEyebrow: {
    marginBottom: 0,
  },
  councilChoiceEyebrowText: {
    ...typography.micro,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  choiceHelperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 2,
  },
  choiceHelperText: {
    ...typography.caption,
    fontWeight: '500',
    lineHeight: 17,
  },
  choiceContextText: {
    ...typography.caption,
    fontWeight: '500',
    lineHeight: 17,
  },
  rowUser: {
    alignItems: 'flex-end',
    marginBottom: 12,
    marginLeft: 48,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    borderRadius: 16,
    borderTopRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  msgTextAssistant: {
    ...typography.bodySm,
    lineHeight: 21,
  },
  bubbleExpertTitle: {
    ...typography.label,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  msgTextUser: {
    ...typography.bodySm,
    lineHeight: 21,
    fontWeight: '500',
  },
  customChoiceCancelBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.14),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  starterWrap: {
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  starterEyebrow: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  starterList: {
    gap: 8,
  },
  starterChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  starterChipText: {
    flex: 1,
    ...typography.compact,
    fontWeight: '600',
  },
  modeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  modeBtnLabel: {
    ...typography.compact,
    fontWeight: '700',
    lineHeight: 18,
  },
  modeBtnSub: {
    ...typography.label,
    lineHeight: 15,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: screenContentGutter,
    marginTop: -4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorBannerTxt: {
    flex: 1,
    ...typography.subhead,
    fontWeight: '500',
  },
  footer: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  continuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: screenContentGutter,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  continuePillText: {
    ...typography.bodySm,
    fontWeight: '600',
  },
  softHintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    minHeight: 32,
    gap: 8,
  },
  softHint: {
    ...typography.caption,
    fontWeight: '500',
    textAlign: 'right',
    paddingHorizontal: 4,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  modeToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modeToggleLabel: {
    ...typography.label,
    fontWeight: '600',
  },
  composerShell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 10,
    minHeight: 48,
    maxHeight: Platform.OS === 'web' ? 160 : undefined,
  },
  composerInput: {
    flex: 1,
    minHeight: 22,
    maxHeight: 120,
    ...typography.body,
    lineHeight: 22,
    paddingTop: 0,
    paddingBottom: 0,
    margin: 0,
    fontWeight: '400',
    ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' } : {}),
  },
  sendCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendCircleDisabled: {
    opacity: 0.38,
  },
  clarifyCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  clarifyCardInner: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  clarifyEyebrow: {
    ...typography.label,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  specialistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  specialistPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 1,
  },
  specialistPillText: {
    ...typography.caption,
    fontWeight: '800',
  },
  progressText: {
    ...typography.caption,
    fontWeight: '700',
    flexShrink: 0,
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  supportingExpertsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  supportingExpertsLabel: {
    ...typography.micro,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  almostReadyHint: {
    ...typography.caption,
    fontWeight: '600',
  },
  clarifySendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  clarifySendingText: {
    ...typography.caption,
    fontWeight: '600',
  },
  clarifyQuestion: {
    ...typography.bodySm,
    lineHeight: 21,
    fontWeight: '700',
  },
  whyCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 4,
  },
  whyLabel: {
    ...typography.micro,
    fontWeight: '700',
    letterSpacing: 0.35,
  },
  whyText: {
    ...typography.caption,
    lineHeight: 18,
    fontWeight: '500',
  },
  clarifyHelper: {
    marginTop: -2,
    ...typography.subhead,
    fontWeight: '500',
  },
  clarifyChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  clarifyChoicesColumn: {
    gap: 6,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    minHeight: 48,
  },
  choiceCardOther: {
    minHeight: 48,
  },
  choiceCardBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  choiceCardLabel: {
    ...typography.compact,
    lineHeight: 18,
    fontWeight: '700',
  },
  choiceCardDesc: {
    ...typography.caption,
    fontWeight: '500',
  },
  clarifyChip: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  clarifyChipText: {
    ...typography.caption,
    lineHeight: 16,
    fontWeight: '600',
  },
  customChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customChoiceInput: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    ...typography.compact,
    fontWeight: '500',
  },
  customChoiceSend: {
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customChoiceSendText: {
    ...typography.subhead,
    fontWeight: '800',
  },
  customChoiceCancel: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  customChoiceCancelText: {
    ...typography.caption,
    fontWeight: '700',
  },
});
