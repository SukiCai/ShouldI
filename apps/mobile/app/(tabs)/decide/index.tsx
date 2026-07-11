import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { resolveAppChromatics } from '@/constants/appChromatics';
import {
  PROFILE_HERO_GRADIENT_DARK,
  PROFILE_HERO_GRADIENT_LIGHT,
  palette,
  profileNeutralStroke,
  profileTypography,
  screenContentGutter,
  spacing,
  themeSurface,
  typography,
} from '@/constants/theme';
import { apiGetJson, apiPostJson } from '@/lib/api';
import { HARMENCE_OFFLINE_BUBBLE, PAST_SESSIONS_HINT, userFacingApiError } from '@/lib/userFacingErrors';
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

import { useDecideWizard } from './context';

const readable: Record<DecisionCategory, string> = {
  life: 'Life path',
  career: 'Career move',
  relationship: 'Relationship',
  money: 'Money trade-off',
};

function bubbleKey(b: DecideInterviewBubble) {
  return b.id;
}

const STARTER_CHIPS = [
  { short: 'Co-op offer', prompt: 'Should I accept a co-op offer at a big-tech company?' },
  { short: 'Job offer', prompt: 'Should I take this full-time job offer?' },
  { short: 'Break up', prompt: 'Should I break up with my partner?' },
  { short: 'Big purchase', prompt: 'Should I make a major purchase?' },
] as const;

const HARMENCE_INTRO_SHORT =
  "What's the decision you're wrestling with? I'll ask follow-ups until we reach a clear verdict.";

function formatBubbleText(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1');
}

function displayAssistantText(item: DecideInterviewBubble, allMessages: DecideInterviewBubble[]): string {
  const text = formatBubbleText(item.text);
  if (item.role !== 'assistant') return text;
  const firstAssistantIdx = allMessages.findIndex((m) => m.role === 'assistant');
  const itemIdx = allMessages.indexOf(item);
  if (
    itemIdx === firstAssistantIdx &&
    itemIdx >= 0 &&
    (text.includes("I'm Harmence") || text.length > 120)
  ) {
    return HARMENCE_INTRO_SHORT;
  }
  return text;
}

function isMetaChoiceCopy(text: string): boolean {
  return /wants to check the highest-leverage unknown|before the council recommends/i.test(
    formatBubbleText(text),
  );
}

function choicePromptHeadline(prompt: DecideInterviewChoicePrompt): string {
  const question = formatBubbleText(prompt.question).trim();
  if (!isMetaChoiceCopy(question)) return question;
  if (prompt.title.trim()) {
    return `What best describes the ${prompt.title.toLowerCase()}?`;
  }
  return 'Which of these fits your situation?';
}

function expertCouncilSummary(verdicts: Array<{ verdictLine: string }>): string | null {
  if (verdicts.length === 0) return null;
  const yes = verdicts.filter((v) => /^yes\b/i.test(v.verdictLine.trim())).length;
  const no = verdicts.filter((v) => /^no\b/i.test(v.verdictLine.trim())).length;
  if (yes === 0 && no === 0) return `${verdicts.length} expert views`;
  return `${verdicts.length} experts · ${yes} yes, ${no} no`;
}

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

function ThinkingRow({
  label = 'Harmence is thinking…',
  accent,
  muted,
}: {
  label?: string;
  accent: string;
  muted: string;
}) {
  const dot1 = React.useRef(new Animated.Value(0.35)).current;
  const dot2 = React.useRef(new Animated.Value(0.35)).current;
  const dot3 = React.useRef(new Animated.Value(0.35)).current;

  React.useEffect(() => {
    const pulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.35, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 140);
    const a3 = pulse(dot3, 280);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={[styles.thinkingRow, styles.msgPadH]}>
      <View style={styles.thinkingDots}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={[styles.thinkingDot, { backgroundColor: accent, opacity: dot }]} />
        ))}
      </View>
      <Text style={[styles.thinkingLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

function ExpertGlyph({
  expert,
  fallbackColor,
  size = 30,
}: {
  expert?: Pick<DecideInterviewExpert, 'title' | 'icon' | 'color'> | null;
  fallbackColor: string;
  size?: number;
}) {
  const iconName = (expert?.icon ?? 'sparkles-outline') as keyof typeof Ionicons.glyphMap;
  const color = expert?.color ?? fallbackColor;
  return (
    <View
      accessibilityLabel={expert?.title ?? 'Harmence expert'}
      style={[
        styles.expertGlyph,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${color}22`,
          borderColor: `${color}55`,
        },
      ]}>
      <Ionicons name={iconName} size={Math.max(13, Math.floor(size * 0.52))} color={color} />
    </View>
  );
}

function mergeDeduped(messages: DecideInterviewBubble[], additions: DecideInterviewBubble[]) {
  const map = new Map<string, DecideInterviewBubble>();
  for (const m of messages) map.set(bubbleKey(m), m);
  for (const m of additions) map.set(bubbleKey(m), m);
  return Array.from(map.values()).sort((a, b) => a.at - b.at);
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
  } = useViewerEntitlements();
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const insets = useSafeAreaInsets();
  const isDark = scheme === 'dark';
  const chrom = React.useMemo(() => resolveAppChromatics(isDark, surface), [isDark, surface]);

  const colors = React.useMemo(
    () => ({
      pageBg: surface.canvas,
      composerBg: isDark ? surface.groupedSurface : surface.statTileBg,
      composerBorder: isDark ? 'rgba(255,255,255,0.12)' : surface.groupedBorder,
      assistantBubbleBg: isDark ? surface.groupedSurface : surface.statTileBg,
      assistantBubbleBorder: isDark ? 'rgba(255,255,255,0.1)' : surface.groupedBorder,
      userBubbleBg: isDark ? palette.heroInk : `${chrom.sky}20`,
      userBubbleBorder: isDark ? 'rgba(255,255,255,0.1)' : `${chrom.sky}42`,
      headerHairline: surface.hairline,
      muted: surface.textMuted,
      primaryTxt: surface.textPrimary,
      sendFab: chrom.mint,
      modalBg: isDark ? palette.nightWash : surface.sheet,
      sparklesGlyph: chrom.mint,
    }),
    [isDark, surface, chrom],
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
  const [newlyActivatedExperts, setNewlyActivatedExperts] = React.useState<DecideInterviewExpert[]>([]);
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

  const listRef = React.useRef<FlatList>(null);
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
      setNewlyActivatedExperts(parsed.newlyActivatedExperts ?? []);
      setMessages((prev) => mergeDeduped(prev, parsed.bubbles));
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
        });
      }

      queueMicrotask(() => listRef.current?.scrollToEnd({ animated: true }));
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
          setError(userFacingApiError(e, 'Harmence isn’t available right now. Please try again.'));
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
      setNewlyActivatedExperts([]);
      setMessages([...detail.bubbles].sort((a, b) => a.at - b.at));
      setChoicePrompt(detail.choicePrompt ?? null);
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
    setNewlyActivatedExperts([]);
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
  const isCouncil = mode === 'complex';
  const headerTitle = isCouncil ? 'Harmence Council' : 'Harmence';
  const modeLabel = isCouncil ? 'Expert council' : 'One expert';
  const subtitle =
    isCouncil && activeExperts.length > 1
      ? `${activeExperts.length} experts helping`
      : isCouncil && activeExperts.length === 1
        ? 'Expert council · building your team'
        : !isCouncil && primaryExpert
          ? primaryExpert.title
          : choicePrompt?.specialistLabel ?? (draft.category ? `${readable[draft.category]} · ${modeLabel}` : modeLabel);
  const progressText = choicePrompt?.progress
    ? choicePrompt.progress.ambiguity !== undefined
      ? `Clarity ${Math.round((1 - choicePrompt.progress.ambiguity) * 100)}%`
      : choicePrompt.progress.mode === 'adaptive' || !choicePrompt.progress.total
        ? `Check ${choicePrompt.progress.checked + 1} · adaptive`
        : `${choicePrompt.progress.checked}/${choicePrompt.progress.total} ${choicePrompt.progress.label ?? 'checks'}`
    : null;
  const progressPercent = choicePrompt?.progress ? progressRatio(choicePrompt.progress) * 100 : 0;
  const showStarterPrompts =
    !booting && !choicePrompt && !finalReady && !sending && !!sessionId && messages.length <= 1;
  const useRichOptions = !!choicePrompt?.options.some((o) => o.description?.trim());
  const verdictAccent =
    verdictWord === 'YES' ? chrom.mint : verdictWord === 'NO' ? palette.playful : chrom.sky;
  const choiceCardTranslate = choiceCardAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const expertForBubble = React.useCallback(
    (item: DecideInterviewBubble): DecideInterviewExpert | null => {
      if (!item.expertId) return null;
      return (
        expertMap.get(item.expertId) ?? {
          id: item.expertId,
          title: item.expertTitle ?? 'Harmence expert',
          skillName: item.expertTitle ?? item.expertId,
          icon: item.expertIcon ?? 'sparkles-outline',
          color: item.expertColor ?? chrom.mint,
        }
      );
    },
    [chrom.mint, expertMap],
  );

  const bottomPad = Math.max(insets.bottom, 10);
  const activeChoiceMessageIndex = React.useMemo(() => {
    if (!choicePrompt || finalReady || isTypingCustomChoice) return -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'assistant') return i;
    }
    return -1;
  }, [choicePrompt, finalReady, isTypingCustomChoice, messages]);
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

  const renderInlineChoiceOptions = () => {
    if (!choicePrompt || finalReady || isTypingCustomChoice || sending) return null;

    const optionBody = useRichOptions ? (
      <View style={styles.clarifyChoicesColumn}>
        {choicePrompt.options.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={`Select ${option.label}`}
            disabled={sending}
            onPress={() => {
              void handleChoiceSelect(option);
            }}
            style={({ pressed }) => [
              styles.choiceCard,
              {
                borderColor: isDark ? `${chrom.mint}40` : `${chrom.sky}50`,
                backgroundColor: pressed
                  ? isDark
                    ? `${chrom.mint}20`
                    : `${chrom.sky}18`
                  : isDark
                    ? `${chrom.mint}10`
                    : `${chrom.sky}0C`,
              },
            ]}>
            <View style={styles.choiceCardBody}>
              <Text style={[styles.choiceCardLabel, { color: colors.primaryTxt }]}>{option.label}</Text>
              {option.description ? (
                <Text style={[styles.choiceCardDesc, { color: colors.muted }]}>{option.description}</Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={isDark ? chrom.mint : chrom.sky} />
          </Pressable>
        ))}
        {choicePrompt.allowCustomAnswer ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Type another answer"
            disabled={sending}
            onPress={() => setIsTypingCustomChoice(true)}
            style={({ pressed }) => [
              styles.choiceCard,
              styles.choiceCardOther,
              {
                borderColor: colors.composerBorder,
                backgroundColor: pressed ? colors.composerBg : colors.pageBg,
              },
            ]}>
            <View style={styles.choiceCardBody}>
              <Text style={[styles.choiceCardLabel, { color: colors.muted }]}>Other — type my own answer</Text>
            </View>
            <Ionicons name="create-outline" size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    ) : (
      <View style={styles.clarifyChoices}>
        {choicePrompt.options.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={`Select ${option.label}`}
            disabled={sending}
            onPress={() => {
              void handleChoiceSelect(option);
            }}
            style={[
              styles.clarifyChip,
              {
                borderColor: isDark ? `${chrom.mint}55` : `${chrom.sky}55`,
                backgroundColor: isDark ? `${chrom.mint}16` : `${chrom.sky}14`,
              },
            ]}>
            <Text style={[styles.clarifyChipText, { color: isDark ? chrom.mint : chrom.sky }]}>{option.label}</Text>
          </Pressable>
        ))}
        {choicePrompt.allowCustomAnswer ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Type another answer"
            disabled={sending}
            onPress={() => setIsTypingCustomChoice(true)}
            style={[styles.clarifyChip, { borderColor: colors.composerBorder, backgroundColor: colors.pageBg }]}>
            <Text style={[styles.clarifyChipText, { color: colors.muted }]}>Other…</Text>
          </Pressable>
        ) : null}
      </View>
    );

    return (
      <Animated.View
        style={[
          styles.inlineChoiceBlock,
          { opacity: choiceCardAnim, transform: [{ translateY: choiceCardTranslate }] },
        ]}>
        <View
          style={[
            styles.choicePanel,
            {
              borderColor: isDark ? `${chrom.mint}30` : `${chrom.sky}35`,
              backgroundColor: isDark ? `${chrom.mint}08` : `${chrom.sky}06`,
            },
          ]}>
          {choicePrompt.supportingExpertIds && choicePrompt.supportingExpertIds.length > 0 ? (
            <View style={styles.supportingExpertsRow}>
              <Text style={[styles.supportingExpertsLabel, { color: colors.muted }]}>Also consulting</Text>
              {choicePrompt.supportingExpertIds.slice(0, 4).map((id) => (
                <ExpertGlyph key={id} expert={expertMap.get(id)} fallbackColor={chrom.sky} size={20} />
              ))}
            </View>
          ) : null}
          {almostReady ? (
            <Text style={[styles.almostReadyHint, { color: chrom.mint }]}>
              Almost ready — one or two more answers and Harmence can recommend.
            </Text>
          ) : null}
          {choicePrompt.whyItMatters ? (
            <View
              style={[
                styles.whyCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : palette.white,
                  borderColor: colors.composerBorder,
                },
              ]}>
              <Text style={[styles.whyLabel, { color: chrom.mint }]}>Why this matters</Text>
              <Text style={[styles.whyText, { color: colors.primaryTxt }]}>{choicePrompt.whyItMatters}</Text>
            </View>
          ) : null}
          {choicePrompt.helperText ? (
            <View style={styles.choiceHelperRow}>
              <Ionicons name="information-circle-outline" size={15} color={colors.muted} />
              <Text style={[styles.choiceHelperText, { color: colors.muted }]}>{choicePrompt.helperText}</Text>
            </View>
          ) : null}
          {optionBody}
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
            paddingTop: insets.top + 6,
            borderBottomColor: surface.hairline,
          },
        ]}>
        <LinearGradient
          colors={isDark ? PROFILE_HERO_GRADIENT_DARK : PROFILE_HERO_GRADIENT_LIGHT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Past sessions"
          onPress={openPastSessions}
          style={styles.headerIconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 10 }}>
          <Ionicons name="time-outline" size={24} color={chrom.gearIcon} />
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <View style={styles.titleRow}>
            <Text style={[styles.agentTitle, { color: chrom.display }]}>
              {headerTitle}
            </Text>
            <View
              style={[
                styles.liveDot,
                { backgroundColor: hermesIntegrated ? chrom.mint : chrom.textMuted },
              ]}
            />
          </View>
          <Text style={[styles.agentSubtitle, { color: chrom.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
          {!modeLocked && !booting && !finalReady ? (
            <View
              style={[
                styles.headerModeSegment,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' },
              ]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Single expert mode"
                accessibilityState={{ selected: mode === 'single' }}
                onPress={() => handleModeChange('single')}
                style={[
                  styles.headerModeBtn,
                  mode === 'single' && {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : palette.white,
                    borderColor: chrom.mint,
                  },
                ]}>
                <Text
                  style={[
                    styles.headerModeBtnText,
                    { color: mode === 'single' ? chrom.mint : chrom.textMuted },
                  ]}>
                  Single
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isPremium
                    ? 'Expert council mode (Premium)'
                    : canAccessCouncil
                      ? `Expert council mode, ${councilSessionCost} points per session`
                      : 'Expert council mode (Premium or points required)'
                }
                accessibilityState={{ selected: mode === 'complex' }}
                onPress={trySelectCouncil}
                style={[
                  styles.headerModeBtn,
                  mode === 'complex' && {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : palette.white,
                    borderColor: chrom.mint,
                  },
                  !isPremium && mode !== 'complex' && !canAccessCouncil && styles.headerModeBtnLocked,
                ]}>
                <View style={styles.headerModeBtnInner}>
                  {!isPremium && mode !== 'complex' ? (
                    <Ionicons
                      name={canAccessCouncil ? 'diamond-outline' : 'lock-closed'}
                      size={11}
                      color={chrom.textMuted}
                    />
                  ) : isPremium ? (
                    <Ionicons name="star" size={11} color={mode === 'complex' ? chrom.mint : chrom.textMuted} />
                  ) : null}
                  <Text
                    style={[
                      styles.headerModeBtnText,
                      { color: mode === 'complex' ? chrom.mint : chrom.textMuted },
                    ]}>
                    Council
                  </Text>
                  {!isPremium && mode !== 'complex' ? (
                    <Text style={[styles.headerModeCost, { color: chrom.textMuted }]}>{councilSessionCost}</Text>
                  ) : null}
                </View>
              </Pressable>
            </View>
          ) : null}
          {activeExperts.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${activeExperts.length} active experts`}
              onPress={() => setExpertsOpen(true)}
              style={styles.headerExperts}>
              {activeExperts.slice(0, 3).map((expert) => (
                <ExpertGlyph key={expert.id} expert={expert} fallbackColor={chrom.mint} size={22} />
              ))}
              {activeExperts.length > 3 ? (
                <View style={[styles.expertOverflow, { borderColor: colors.composerBorder, backgroundColor: colors.composerBg }]}>
                  <Text style={[styles.expertOverflowText, { color: colors.muted }]}>+{activeExperts.length - 3}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
          {choicePrompt?.progress ? (
            <View style={styles.headerProgressRow}>
              <View style={[styles.headerProgressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]}>
                <View
                  style={[
                    styles.headerProgressFill,
                    { width: `${progressPercent}%`, backgroundColor: chrom.mint },
                  ]}
                />
              </View>
              {progressText ? (
                <Text style={[styles.headerProgressLabel, { color: chrom.textMuted }]}>{progressText}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New chat"
          onPress={startFreshSession}
          disabled={booting || sending}
          style={[styles.headerIconBtn, (booting || sending) && { opacity: 0.35 }]}
          hitSlop={{ top: 8, bottom: 8, left: 10, right: 4 }}>
          <Ionicons name="create-outline" size={24} color={chrom.gearIcon} />
        </Pressable>
      </View>

      {booting ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={chrom.mint} size="large" />
          <Text style={[styles.loadingLabel, { color: colors.muted }]}>Loading…</Text>
        </View>
      ) : finalReady && finalDecision ? (
        <View style={styles.verdictScreen}>
          <LinearGradient
            colors={isDark ? ['#050816', '#0F172A', '#062B2F'] : ['#E0F2FE', '#F8FAFC', '#D1FAE5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.verdictHalo,
              {
                backgroundColor: verdictAccent,
                opacity: verdictHalo,
                transform: [{ scale: verdictScale }],
              },
            ]}
          />
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.verdictScrollContent}>
          <Animated.View style={[styles.verdictOrb, { transform: [{ scale: verdictScale }] }]}>
            <LinearGradient
              colors={isDark ? [verdictAccent, chrom.sky] : [chrom.sky, verdictAccent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.verdictOrbGradient}>
              <Ionicons
                name={verdictWord === 'NO' ? 'shield-outline' : 'sparkles'}
                size={34}
                color={chrom.ctaOnGradient}
              />
            </LinearGradient>
          </Animated.View>
          <Text style={[styles.verdictKicker, { color: verdictAccent }]}>
            {isCouncil ? 'Council decision' : 'Harmence decision'}
          </Text>
          <Text style={[styles.verdictWord, { color: verdictAccent }]}>{verdictWord}</Text>
          <Text style={[styles.verdictSentence, { color: colors.primaryTxt }]}>
            {finalDecision.verdictLine}
          </Text>
          {councilSummary ? (
            <Text style={[styles.verdictCouncilSummary, { color: colors.muted }]}>{councilSummary}</Text>
          ) : null}
          <Text
            style={[styles.verdictReason, { color: colors.muted }]}
            numberOfLines={verdictExpanded ? undefined : 3}>
            {finalDecision.recommendation}
          </Text>
          {verdictExpanded && finalDecision.rationale?.trim() ? (
            <Text style={[styles.verdictRationale, { color: colors.muted }]}>{finalDecision.rationale}</Text>
          ) : null}
          {verdictExpanded && finalDecision.expertVerdicts.length > 0 ? (
            <View style={styles.expertVerdictsWrap}>
              {finalDecision.expertVerdicts.map((verdict) => {
                const expert = expertMap.get(verdict.expertId);
                return (
                  <View
                    key={verdict.expertId}
                    style={[styles.expertVerdictCard, { borderColor: colors.composerBorder, backgroundColor: colors.composerBg }]}>
                    <View style={styles.expertVerdictHead}>
                      <ExpertGlyph expert={expert} fallbackColor={chrom.mint} size={26} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.expertVerdictTitle, { color: colors.primaryTxt }]}>
                          {verdict.expertTitle}
                        </Text>
                        <Text style={[styles.expertVerdictLine, { color: expert?.color ?? verdictAccent }]}>
                          {verdict.verdictLine}
                        </Text>
                        <Text style={[styles.expertVerdictConfidence, { color: colors.muted }]}>
                          Confidence: {verdict.confidence}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.expertVerdictReason, { color: colors.muted }]}>{verdict.reasoning}</Text>
                    {verdict.risks.length > 0 ? (
                      <Text style={[styles.expertVerdictMeta, { color: colors.muted }]}>
                        Risks: {verdict.risks.join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
          {verdictExpanded && finalDecision.reflection?.summary ? (
            <View style={[styles.reflectionCard, { borderColor: colors.composerBorder, backgroundColor: colors.composerBg }]}>
              <Text style={[styles.reflectionTitle, { color: chrom.mint }]}>What we heard</Text>
              <Text style={[styles.reflectionBody, { color: colors.primaryTxt }]}>{finalDecision.reflection.summary}</Text>
              {finalDecision.reflection.concerns?.map((concern) => (
                <Text key={concern} style={[styles.reflectionConcern, { color: colors.muted }]}>
                  · {concern}
                </Text>
              ))}
            </View>
          ) : null}
          {verdictExpanded && finalDecision.nextSteps.length > 0 ? (
            <View style={[styles.verdictSteps, { borderColor: colors.composerBorder }]}>
              <Text style={[styles.verdictStepsTitle, { color: colors.primaryTxt }]}>Next steps</Text>
              {finalDecision.nextSteps.map((step) => (
                <View key={step} style={styles.verdictStepRow}>
                  <View style={[styles.verdictStepDot, { backgroundColor: verdictAccent }]} />
                  <Text style={[styles.verdictStepText, { color: colors.muted }]}>{step}</Text>
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
              <Text style={[styles.verdictExpandText, { color: verdictAccent }]}>
                {verdictExpanded
                  ? 'Show less'
                  : finalDecision.expertVerdicts.length > 0
                    ? 'See how each expert voted'
                    : 'See full reasoning'}
              </Text>
              <Ionicons
                name={verdictExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={verdictAccent}
              />
            </Pressable>
          ) : null}
          <View style={styles.verdictActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Review Explore card"
              onPress={() => router.push('/(tabs)/decide/confirm')}
              style={[styles.verdictPrimary, { backgroundColor: chrom.mint }]}>
              <Text style={[styles.verdictPrimaryText, { color: chrom.ctaOnGradient }]}>Review Explore card</Text>
              <Ionicons name="arrow-forward" size={18} color={chrom.ctaOnGradient} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start a new decision"
              onPress={startFreshSession}
              style={[styles.verdictSecondary, { borderColor: colors.composerBorder, backgroundColor: colors.composerBg }]}>
              <Text style={[styles.verdictSecondaryText, { color: colors.primaryTxt }]}>Ask another</Text>
            </Pressable>
          </View>
          </ScrollView>
        </View>
      ) : (
        <View style={styles.interactionShell}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={bubbleKey}
          style={styles.list}
          contentContainerStyle={[styles.listContent, { flexGrow: 1, paddingBottom: spacing.sm }]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            <>
              {sending ? <ThinkingRow accent={chrom.mint} muted={colors.muted} /> : null}
              {newlyActivatedExperts.length > 0 ? (
                <View
                  style={[
                    styles.newExpertBanner,
                    styles.msgPadH,
                    { borderColor: colors.composerBorder, backgroundColor: colors.composerBg },
                  ]}>
                  <View style={styles.newExpertIcons}>
                    {newlyActivatedExperts.map((expert) => (
                      <ExpertGlyph key={expert.id} expert={expert} fallbackColor={chrom.mint} size={24} />
                    ))}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.newExpertText, { color: colors.primaryTxt }]}>
                      {newlyActivatedExperts.map((expert) => expert.title).join(', ')}{' '}
                      {isCouncil ? 'joined the council' : 'joined to help'}.
                    </Text>
                    {newlyActivatedExperts[0]?.subtitle ? (
                      <Text style={[styles.newExpertSub, { color: colors.muted }]} numberOfLines={2}>
                        {newlyActivatedExperts[0].subtitle}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
              {choicePrompt && !finalReady && !isTypingCustomChoice && activeChoiceMessageIndex === -1 ? (
                <View style={[styles.rowAssistant, styles.msgPadH]}>
                  <View style={styles.assistantLeading}>
                    <ExpertGlyph expert={primaryExpert} fallbackColor={chrom.mint} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View
                      style={[
                        styles.assistantBubble,
                        styles.assistantBubbleActive,
                        {
                          backgroundColor: colors.assistantBubbleBg,
                          borderColor: chrom.mint,
                        },
                      ]}>
                      <Text style={[styles.msgTextAssistant, { color: colors.primaryTxt }]}>
                        {choicePromptHeadline(choicePrompt)}
                      </Text>
                    </View>
                    {renderInlineChoiceOptions()}
                  </View>
                </View>
              ) : null}
            </>
          }
          renderItem={({ item, index }) =>
            item.role === 'assistant' ? (
              <View style={[styles.rowAssistant, styles.msgPadH]}>
                <View style={styles.assistantLeading}>
                  <ExpertGlyph expert={expertForBubble(item)} fallbackColor={colors.sparklesGlyph} />
                  {item.supportingExpertIds.length > 0 ? (
                    <View style={styles.supportingStack}>
                      {item.supportingExpertIds.slice(0, 3).map((id) => (
                        <ExpertGlyph key={id} expert={expertMap.get(id)} fallbackColor={chrom.sky} size={18} />
                      ))}
                    </View>
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={[
                      styles.assistantBubble,
                      index === activeChoiceMessageIndex && styles.assistantBubbleActive,
                      {
                        backgroundColor: colors.assistantBubbleBg,
                        borderColor:
                          index === activeChoiceMessageIndex ? chrom.mint : colors.assistantBubbleBorder,
                      },
                    ]}>
                    {expertForBubble(item) ? (
                      <Text style={[styles.bubbleExpertTitle, { color: expertForBubble(item)?.color ?? chrom.mint }]}>
                        {expertForBubble(item)?.title}
                      </Text>
                    ) : null}
                    <Text selectable style={[styles.msgTextAssistant, { color: colors.primaryTxt }]}>
                      {index === activeChoiceMessageIndex && choicePrompt
                        ? choicePromptHeadline(choicePrompt)
                        : displayAssistantText(item, messages)}
                    </Text>
                  </View>
                  {index === activeChoiceMessageIndex ? renderInlineChoiceOptions() : null}
                </View>
              </View>
            ) : (
              <View style={[styles.rowUser, styles.msgPadH]}>
                <View
                  style={[
                    styles.userBubble,
                    {
                      backgroundColor: colors.userBubbleBg,
                      borderColor: colors.userBubbleBorder,
                    },
                  ]}>
                  <Text selectable style={[styles.msgTextUser, { color: isDark ? palette.sheet : profileTypography.ink }]}>
                    {item.text}
                  </Text>
                </View>
              </View>
            )
          }
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
              paddingBottom: bottomPad,
              backgroundColor: colors.pageBg,
              borderTopColor: colors.headerHairline,
            },
          ]}>
        {showStarterLaunchPad ? (
          <View style={[styles.launchPad, styles.msgPadH]}>
            {isCouncil ? (
              <Text style={[styles.councilHint, { color: colors.muted }]}>
                {isPremium
                  ? 'Premium · multiple specialists weigh in — each view at the end.'
                  : `Multiple specialists weigh in — ${councilSessionCost} points per session.`}
              </Text>
            ) : null}
            <Text style={[styles.launchPadLabel, { color: colors.muted }]}>Try asking</Text>
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
                      borderColor: isDark ? `${chrom.mint}55` : `${chrom.sky}55`,
                      backgroundColor: isDark ? `${chrom.mint}16` : `${chrom.sky}14`,
                    },
                  ]}>
                  <Text style={[styles.launchChipText, { color: isDark ? chrom.mint : chrom.sky }]}>
                    {chip.short}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {isTypingCustomChoice ? (
          <View style={[styles.customAnswerBar, styles.msgPadH]}>
            <Text style={[styles.customAnswerLabel, { color: colors.muted }]}>Your answer</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel custom answer"
              onPress={() => {
                setIsTypingCustomChoice(false);
                setCustomChoice('');
              }}>
              <Text style={[styles.customAnswerCancel, { color: chrom.mint }]}>Cancel</Text>
            </Pressable>
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
                  ? 'Type your answer…'
                  : booting
                    ? 'Connecting…'
                    : messages.length <= 1
                      ? 'e.g. Should I accept this co-op offer?'
                      : 'Add more context…'
              }
              placeholderTextColor={colors.muted}
              editable={!booting && !sending && !!sessionId}
              autoFocus={isTypingCustomChoice}
              style={[styles.composerInput, { color: colors.primaryTxt }]}
              multiline
              maxFontSizeMultiplier={Platform.OS === 'ios' ? 1.35 : undefined}
            />
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
                <ActivityIndicator color={chrom.ctaOnGradient} size="small" />
              ) : (
                <Ionicons name="paper-plane-outline" size={17} color={chrom.ctaOnGradient} />
              )}
            </Pressable>
          </View>
        ) : null}
        </View>
      ) : null}
        </View>
      )}

      <Modal transparent animationType="slide" visible={sessionsOpen} onRequestClose={() => setSessionsOpen(false)}>
        <View style={[styles.sheetBackdrop]}>
          <Pressable style={styles.sheetBackdropTouch} accessibilityLabel="Dismiss" onPress={() => setSessionsOpen(false)} />
          <View
            style={[
              styles.sheetCard,
              { backgroundColor: colors.modalBg, paddingBottom: bottomPad + 12, borderTopColor: colors.composerBorder },
            ]}>
            <View style={[styles.sheetGrab, { backgroundColor: isDark ? profileNeutralStroke(0.38) : profileNeutralStroke(0.22) }]} />
            <View style={styles.sheetHeadRow}>
              <Text style={[styles.sheetTitle, { color: colors.primaryTxt }]}>Chats</Text>
              <Pressable hitSlop={12} onPress={() => setSessionsOpen(false)} accessibilityRole="button">
                <Text style={[styles.sheetClose, { color: colors.muted }]}>Done</Text>
              </Pressable>
            </View>
            <Text style={[styles.sheetHint, { color: colors.muted }]}>{PAST_SESSIONS_HINT}</Text>
            {listLoading ? (
              <ActivityIndicator color={chrom.mint} style={{ marginVertical: spacing.lg }} />
            ) : (
              <FlatList
                data={sessions}
                keyExtractor={(s) => s.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.sheetList}
                ListEmptyComponent={
                  <Text style={[styles.emptyList, { color: colors.muted }]}>No past conversations.</Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open chat ${item.preview}`}
                    onPress={() => void activateSessionFromHistory(item.id)}
                    style={[styles.sheetRow, { borderBottomColor: colors.composerBorder }]}>
                    <View style={[styles.sheetRowGlyph, { backgroundColor: colors.composerBg }]}>
                      <Ionicons name="chatbubbles-outline" size={17} color={chrom.sky} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={2} style={[styles.sheetRowTitle, { color: colors.primaryTxt }]}>
                        {item.preview || 'New intake'}
                      </Text>
                      <Text style={[styles.sheetRowTs, { color: colors.muted }]}>
                        {new Date(item.updatedAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={expertsOpen} onRequestClose={() => setExpertsOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetBackdropTouch} accessibilityLabel="Dismiss" onPress={() => setExpertsOpen(false)} />
          <View
            style={[
              styles.sheetCard,
              { backgroundColor: colors.modalBg, paddingBottom: bottomPad + 12, borderTopColor: colors.composerBorder },
            ]}>
            <View style={[styles.sheetGrab, { backgroundColor: isDark ? profileNeutralStroke(0.38) : profileNeutralStroke(0.22) }]} />
            <View style={styles.sheetHeadRow}>
              <Text style={[styles.sheetTitle, { color: colors.primaryTxt }]}>
                {isCouncil ? 'Council experts' : 'Active expert'}
              </Text>
              <Pressable hitSlop={12} onPress={() => setExpertsOpen(false)} accessibilityRole="button">
                <Text style={[styles.sheetClose, { color: colors.muted }]}>Done</Text>
              </Pressable>
            </View>
            <Text style={[styles.sheetHint, { color: colors.muted }]}>
              {isCouncil
                ? 'Specialists consulted during this decision.'
                : 'The specialist helping with your decision.'}
            </Text>
            <ScrollView contentContainerStyle={styles.sheetList} keyboardShouldPersistTaps="handled">
              {activeExperts.map((expert) => (
                <View
                  key={expert.id}
                  style={[styles.sheetRow, { borderBottomColor: colors.composerBorder }]}>
                  <ExpertGlyph expert={expert} fallbackColor={chrom.mint} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.sheetRowTitle, { color: colors.primaryTxt }]}>{expert.title}</Text>
                    {expert.subtitle ? (
                      <Text style={[styles.sheetRowTs, { color: colors.muted }]} numberOfLines={2}>
                        {expert.subtitle}
                      </Text>
                    ) : expert.skillName ? (
                      <Text style={[styles.sheetRowTs, { color: colors.muted }]} numberOfLines={1}>
                        {expert.skillName}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={councilPaywallOpen} onRequestClose={() => setCouncilPaywallOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <Pressable
            style={styles.sheetBackdropTouch}
            accessibilityLabel="Dismiss"
            onPress={() => setCouncilPaywallOpen(false)}
          />
          <View
            style={[
              styles.paywallCard,
              {
                backgroundColor: colors.modalBg,
                borderColor: colors.composerBorder,
                marginBottom: bottomPad + 24,
              },
            ]}>
            <View style={[styles.paywallIconWrap, { backgroundColor: `${chrom.mint}18` }]}>
              <Ionicons name="people" size={28} color={chrom.mint} />
            </View>
            <Text style={[styles.paywallTitle, { color: colors.primaryTxt }]}>Expert Council is Premium</Text>
            <Text style={[styles.paywallBody, { color: colors.muted }]}>
              Multiple specialists debate your decision and you see each verdict. Subscribe for unlimited Council
              sessions, or spend {councilSessionCost} points per session.
            </Text>
            {entitlementsHydrated ? (
              <Text style={[styles.paywallBalance, { color: colors.muted }]}>
                Your balance: {pointsBalance.toLocaleString()} pts
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get Premium subscription"
              onPress={() => {
                setCouncilPaywallOpen(false);
                router.push('/(tabs)/you');
              }}
              style={[styles.paywallPrimary, { backgroundColor: chrom.mint }]}>
              <Ionicons name="star" size={16} color={chrom.ctaOnGradient} />
              <Text style={[styles.paywallPrimaryText, { color: chrom.ctaOnGradient }]}>Get Premium</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Use ${councilSessionCost} points for this council session`}
              disabled={!canUseCouncilWithPoints}
              onPress={() => activateCouncilMode('points')}
              style={[
                styles.paywallSecondary,
                {
                  borderColor: colors.composerBorder,
                  backgroundColor: colors.composerBg,
                  opacity: canUseCouncilWithPoints ? 1 : 0.45,
                },
              ]}>
              <Ionicons name="diamond-outline" size={16} color={chrom.sky} />
              <Text style={[styles.paywallSecondaryText, { color: colors.primaryTxt }]}>
                Use {councilSessionCost} points
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Not now"
              onPress={() => setCouncilPaywallOpen(false)}
              style={styles.paywallDismiss}>
              <Text style={[styles.paywallDismissText, { color: colors.muted }]}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 10,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agentTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  agentSubtitle: {
    fontSize: 12,
    marginTop: 2,
    maxWidth: 220,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 16,
  },
  headerModeSegment: {
    flexDirection: 'row',
    marginTop: 8,
    padding: 3,
    borderRadius: 10,
    gap: 2,
  },
  headerModeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  headerModeBtnLocked: {
    opacity: 0.88,
  },
  headerModeBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerModeCost: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerModeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  headerExperts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 6,
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
    fontSize: 10,
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
    fontSize: 11,
    fontWeight: '700',
    minWidth: 72,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
  },
  loadingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  verdictScreen: {
    flex: 1,
    overflow: 'hidden',
  },
  verdictScrollContent: {
    flexGrow: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: screenContentGutter,
    paddingVertical: 32,
  },
  verdictHalo: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  verdictOrb: {
    width: 92,
    height: 92,
    borderRadius: 46,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  verdictOrbGradient: {
    flex: 1,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictKicker: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  verdictWord: {
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '900',
    letterSpacing: -3,
    textAlign: 'center',
  },
  verdictSentence: {
    marginTop: 10,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  verdictCouncilSummary: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  verdictReason: {
    marginTop: 14,
    maxWidth: 360,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  verdictRationale: {
    marginTop: 12,
    maxWidth: 360,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  expertVerdictHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expertVerdictTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  expertVerdictLine: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  expertVerdictReason: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  expertVerdictConfidence: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  expertVerdictMeta: {
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  reflectionBody: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  reflectionConcern: {
    fontSize: 13,
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
    fontSize: 13,
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
    fontSize: 14,
    lineHeight: 20,
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
    fontSize: 14,
    fontWeight: '700',
  },
  verdictActions: {
    width: '100%',
    maxWidth: 360,
    marginTop: 32,
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
    fontSize: 16,
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
    fontSize: 15,
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
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    flexShrink: 0,
  },
  launchPad: {
    gap: 6,
    marginBottom: 2,
  },
  councilHint: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 2,
  },
  launchPadLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  launchPadScroll: {
    gap: 8,
    paddingRight: screenContentGutter,
  },
  launchChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  launchChipText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  listContent: {
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
    gap: 4,
  },
  msgPadH: {
    paddingHorizontal: screenContentGutter,
  },
  rowAssistant: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 10,
  },
  assistantLeading: {
    paddingTop: 2,
    alignItems: 'center',
  },
  expertGlyph: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
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
    borderRadius: 20,
    borderTopLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  assistantBubbleActive: {
    borderWidth: 1.5,
  },
  inlineChoiceBlock: {
    marginTop: 8,
  },
  choicePanel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  choiceHelperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 2,
  },
  choiceHelperText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  customAnswerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -4,
  },
  customAnswerLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  customAnswerCancel: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowUser: {
    alignItems: 'flex-end',
    marginBottom: 14,
    marginLeft: 48,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    borderRadius: 20,
    borderTopRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  msgTextAssistant: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
  },
  bubbleExpertTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  msgTextUser: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  thinkingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  thinkingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  thinkingLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  starterWrap: {
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  starterEyebrow: {
    fontSize: 12,
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
    fontSize: 14,
    lineHeight: 20,
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
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  modeBtnSub: {
    fontSize: 11,
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
    fontSize: 13,
    lineHeight: 18,
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
    fontSize: 15,
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
    fontSize: 12,
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
    fontSize: 11,
    fontWeight: '600',
  },
  newExpertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: screenContentGutter,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  newExpertIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  newExpertText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  newExpertSub: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  composerShell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 4,
    minHeight: 48,
    maxHeight: Platform.OS === 'web' ? 160 : undefined,
  },
  composerInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    fontSize: 16,
    lineHeight: 22,
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
    fontWeight: '400',
  },
  sendCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  sendCircleDisabled: {
    opacity: 0.38,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdropTouch: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  sheetCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '78%',
    paddingTop: 6,
    paddingHorizontal: 0,
  },
  sheetGrab: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  sheetHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenContentGutter,
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.25,
  },
  sheetClose: {
    fontSize: 17,
    fontWeight: '600',
  },
  sheetHint: {
    fontSize: 12,
    paddingHorizontal: screenContentGutter,
    marginBottom: 14,
    lineHeight: 16,
    fontWeight: '500',
  },
  sheetList: {
    paddingHorizontal: screenContentGutter,
    paddingBottom: spacing.sm,
    gap: 0,
  },
  emptyList: {
    paddingVertical: 28,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '500',
  },
  sheetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRowGlyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  sheetRowTs: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '500',
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
    fontSize: 11,
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
    fontSize: 12,
    fontWeight: '800',
  },
  progressText: {
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '700',
  },
  almostReadyHint: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  clarifySendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  clarifySendingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clarifyQuestion: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  whyCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  whyLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  whyText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  clarifyHelper: {
    marginTop: -2,
    fontSize: 13,
    lineHeight: 18,
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
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    minHeight: 52,
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
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  choiceCardDesc: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  clarifyChip: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clarifyChipText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
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
    fontSize: 14,
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
    fontSize: 13,
    fontWeight: '800',
  },
  customChoiceCancel: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  customChoiceCancelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  paywallCard: {
    marginHorizontal: screenContentGutter,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 12,
    alignItems: 'center',
  },
  paywallIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  paywallTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  paywallBody: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
  },
  paywallBalance: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  paywallPrimary: {
    width: '100%',
    minHeight: 48,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  paywallPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
  },
  paywallSecondary: {
    width: '100%',
    minHeight: 46,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  paywallSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
  },
  paywallDismiss: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  paywallDismissText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
