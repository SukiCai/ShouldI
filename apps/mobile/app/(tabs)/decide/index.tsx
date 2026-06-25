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
  useWindowDimensions,
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
import { apiGetJson, apiPostJson, GATEWAY_ORIGIN } from '@/lib/api';
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

const STARTER_PROMPTS = [
  'Should I accept a co-op offer at a big-tech company?',
  'Should I take this full-time job offer?',
  'Should I break up with my partner?',
  'Should I make a major purchase?',
] as const;

function formatBubbleText(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1');
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
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
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
  const modeRef = React.useRef(mode);
  modeRef.current = mode;

  const handleModeChange = React.useCallback(
    (newMode: 'single' | 'complex') => {
      if (newMode === mode) return;
      if (sessionStarted) return;
      setMode(newMode);
      setSessionId(null);
      setMessages([]);
      setFinalDecision(null);
      setFinalReady(false);
      setChoicePrompt(null);
      setSessionStarted(false);
      setBootKey((k) => k + 1);
    },
    [mode, sessionStarted],
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

      if (parsed.isComplete && (parsed.suggestedDraftHints || parsed.previewCard)) {
        const h = parsed.suggestedDraftHints;
        const preview = parsed.previewCard;
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
              : preview?.aiVerdictLine?.trim() || d.communityAiVerdictLine,
          communityAiBecause:
            h?.communityAiBecause?.trim()?.length
              ? h.communityAiBecause.trim()
              : preview?.aiBecause?.trim() || d.communityAiBecause,
          hook: preview?.hook?.trim() || d.hook,
          tension: preview?.tension?.trim() || d.tension,
          pollOptions,
          discussionPreview:
            preview?.discussionPreview?.length ? [...preview.discussionPreview] : d.discussionPreview,
          expertVerdicts: parsed.finalDecision?.expertVerdicts ?? d.expertVerdicts,
          keyMoments: parsed.finalDecision?.keyMoments ?? d.keyMoments,
          aiConfidenceScore: (() => {
            if (parsed.finalDecision?.confidenceScore != null) {
              return parsed.finalDecision.confidenceScore;
            }
            if (parsed.finalDecision) {
              return { low: 35, medium: 60, high: 82 }[parsed.finalDecision.confidence] ?? 60;
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
        const payload = await apiPostJson('/v1/harmence/interview/turn', DecideInterviewTurnRequestSchema.parse({ mode: modeRef.current }));
        if (!cancelled) applyTurnPayload(payload);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Harmence unreachable');
          setMessages([
            {
              id: 'assistant-offline',
              role: 'assistant',
              text:
                `Could not reach Harmence (${GATEWAY_ORIGIN}).\n\n` +
                `Start gateway: npm run api`,
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
  }, [applyTurnPayload, bootKey]);

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
      queueMicrotask(() => listRef.current?.scrollToEnd({ animated: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reopen session.');
    } finally {
      setBooting(false);
    }
  }, []);

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
    setBooting(true);
    void (async () => {
      try {
        const payload = await apiPostJson('/v1/harmence/interview/turn', DecideInterviewTurnRequestSchema.parse({ mode: modeRef.current }));
        applyTurnPayload(payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Harmence unreachable');
      } finally {
        setBooting(false);
      }
    })();
  }, [applyTurnPayload]);

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
        setError(e instanceof Error ? e.message : 'Send failed');
      } finally {
        setSending(false);
      }
    },
    [applyTurnPayload, sending, sessionId],
  );

  const handleSend = async () => {
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
      setError(e instanceof Error ? e.message : 'Selection failed');
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
  const canReview = finalReady && !!(draft.category && draft.title.trim().length > 0);
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
  const subtitle =
    activeExperts.length > 1
      ? `${activeExperts.length} experts helping`
      : primaryExpert?.title ?? choicePrompt?.specialistLabel ?? (draft.category ? readable[draft.category] : 'Intake assistant');
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
  const softHint = choicePrompt
    ? choicePrompt.specialistLabel
      ? 'Pick the answer that best matches your situation.'
      : 'Tap an option below to continue.'
    : finalReady
      ? 'Your recommendation is ready.'
      : messages.length <= 1
        ? 'Describe your decision in your own words — or try a starter below.'
        : 'A few more answers and Harmence can give you a clear verdict.';
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
              {activeExperts.length > 0 ? 'Harmence Council' : 'Harmence'}
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
          {activeExperts.length > 0 ? (
            <View style={styles.headerExperts}>
              {activeExperts.slice(0, 4).map((expert) => (
                <ExpertGlyph key={expert.id} expert={expert} fallbackColor={chrom.mint} size={22} />
              ))}
            </View>
          ) : null}
          {choicePrompt?.progress ? (
            <View style={[styles.headerProgressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]}>
              <View
                style={[
                  styles.headerProgressFill,
                  { width: `${progressPercent}%`, backgroundColor: chrom.mint },
                ]}
              />
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
          <Text style={[styles.verdictKicker, { color: verdictAccent }]}>Harmence decision</Text>
          <Text style={[styles.verdictWord, { color: verdictAccent }]}>{verdictWord}</Text>
          <Text style={[styles.verdictSentence, { color: colors.primaryTxt }]}>
            {finalDecision.verdictLine}
          </Text>
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
                      </View>
                    </View>
                    <Text style={[styles.expertVerdictReason, { color: colors.muted }]}>{verdict.reasoning}</Text>
                  </View>
                );
              })}
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
          {(finalDecision.rationale?.trim() || finalDecision.nextSteps.length > 0) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={verdictExpanded ? 'Show less detail' : 'See full reasoning'}
              onPress={() => setVerdictExpanded((v) => !v)}
              style={styles.verdictExpandBtn}>
              <Text style={[styles.verdictExpandText, { color: verdictAccent }]}>
                {verdictExpanded ? 'Show less' : 'See full reasoning'}
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
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={bubbleKey}
          style={styles.list}
          contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            sending ? (
              <ThinkingRow accent={chrom.mint} muted={colors.muted} />
            ) : showStarterPrompts ? (
              <View style={[styles.starterWrap, styles.msgPadH]}>
                <View style={[styles.modeSelectorRow, modeLocked && { opacity: 0.38 }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Single mode — one expert"
                    disabled={modeLocked}
                    onPress={() => handleModeChange('single')}
                    style={[
                      styles.modeBtn,
                      { borderColor: mode === 'single' ? chrom.mint : colors.composerBorder, backgroundColor: colors.composerBg },
                    ]}>
                    <Text style={[styles.modeBtnLabel, { color: mode === 'single' ? chrom.mint : colors.primaryTxt }]}>Single</Text>
                    <Text style={[styles.modeBtnSub, { color: colors.muted }]}>One expert</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Complex mode — expert council"
                    disabled={modeLocked}
                    onPress={() => handleModeChange('complex')}
                    style={[
                      styles.modeBtn,
                      { borderColor: mode === 'complex' ? chrom.mint : colors.composerBorder, backgroundColor: colors.composerBg },
                    ]}>
                    <Text style={[styles.modeBtnLabel, { color: mode === 'complex' ? chrom.mint : colors.primaryTxt }]}>Complex</Text>
                    <Text style={[styles.modeBtnSub, { color: colors.muted }]}>Expert council</Text>
                  </Pressable>
                </View>
                <Text style={[styles.starterEyebrow, { color: colors.muted }]}>Try asking</Text>
                <View style={styles.starterList}>
                  {STARTER_PROMPTS.map((prompt) => (
                    <Pressable
                      key={prompt}
                      accessibilityRole="button"
                      accessibilityLabel={`Ask: ${prompt}`}
                      onPress={() => {
                        void submitUserText(prompt);
                      }}
                      style={[
                        styles.starterChip,
                        {
                          borderColor: colors.composerBorder,
                          backgroundColor: colors.composerBg,
                        },
                      ]}>
                      <Ionicons name="chatbubble-ellipses-outline" size={15} color={chrom.mint} />
                      <Text style={[styles.starterChipText, { color: colors.primaryTxt }]}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) =>
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
                <View
                  style={[
                    styles.assistantBubble,
                    {
                      backgroundColor: colors.assistantBubbleBg,
                      borderColor: colors.assistantBubbleBorder,
                    },
                  ]}>
                  {expertForBubble(item) ? (
                    <Text style={[styles.bubbleExpertTitle, { color: expertForBubble(item)?.color ?? chrom.mint }]}>
                      {expertForBubble(item)?.title}
                    </Text>
                  ) : null}
                  <Text selectable style={[styles.msgTextAssistant, { color: colors.primaryTxt }]}>
                    {formatBubbleText(item.text)}
                  </Text>
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
      )}

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

      {finalReady && finalDecision ? null : (
      <View
          style={[
            styles.footer,
            {
              paddingBottom: bottomPad,
              backgroundColor: colors.pageBg,
              borderTopColor: colors.headerHairline,
            },
          ]}>
        {canReview ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review briefing and community validation card"
            onPress={() => router.push('/(tabs)/decide/confirm')}
            style={[styles.continuePill, { borderColor: colors.composerBorder, backgroundColor: colors.composerBg }]}>
            <Text style={[styles.continuePillText, { color: colors.primaryTxt }]}>Review & Explore card</Text>
            <Ionicons name="arrow-forward-circle-outline" size={18} color={chrom.mint} />
          </Pressable>
        ) : (
          <View style={[styles.softHintWrap, styles.msgPadH]}>
            <View style={[styles.modeToggleRow, modeLocked && { opacity: 0.38 }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Single expert mode"
                disabled={modeLocked}
                onPress={() => handleModeChange('single')}
                style={[styles.modeToggleBtn, { borderColor: mode === 'single' ? chrom.mint : colors.composerBorder, backgroundColor: colors.composerBg }]}>
                <Text style={[styles.modeToggleLabel, { color: mode === 'single' ? chrom.mint : colors.muted }]}>Single</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Expert council mode"
                disabled={modeLocked}
                onPress={() => handleModeChange('complex')}
                style={[styles.modeToggleBtn, { borderColor: mode === 'complex' ? chrom.mint : colors.composerBorder, backgroundColor: colors.composerBg }]}>
                <Text style={[styles.modeToggleLabel, { color: mode === 'complex' ? chrom.mint : colors.muted }]}>Council</Text>
              </Pressable>
            </View>
            <Text style={[styles.softHint, { color: colors.muted, flex: 1 }]} numberOfLines={2}>
              {softHint}
            </Text>
          </View>
        )}

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
            <Text style={[styles.newExpertText, { color: colors.primaryTxt }]}>
              {newlyActivatedExperts.map((expert) => expert.title).join(', ')} joined the council.
            </Text>
          </View>
        ) : null}

        {choicePrompt && !finalReady ? (
          <Animated.View
            style={[
              styles.clarifyCard,
              {
                marginHorizontal: screenContentGutter,
                backgroundColor: colors.composerBg,
                borderColor: colors.composerBorder,
                opacity: choiceCardAnim,
                transform: [{ translateY: choiceCardTranslate }],
                maxHeight: windowHeight * 0.58,
              },
            ]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.clarifyCardInner}>
            {sending ? (
              <View style={styles.clarifySendingRow}>
                <ActivityIndicator size="small" color={chrom.mint} />
                <Text style={[styles.clarifySendingText, { color: colors.muted }]}>Updating your profile…</Text>
              </View>
            ) : null}
            {choicePrompt.specialistLabel ? (
              <View style={styles.specialistRow}>
                <View style={[styles.specialistPill, { backgroundColor: isDark ? `${chrom.mint}1f` : `${chrom.sky}16`, borderColor: isDark ? `${chrom.mint}45` : `${chrom.sky}45` }]}>
                  {primaryExpert ? <ExpertGlyph expert={primaryExpert} fallbackColor={chrom.mint} size={18} /> : (
                    <Ionicons name="briefcase-outline" size={14} color={isDark ? chrom.mint : chrom.sky} />
                  )}
                  <Text style={[styles.specialistPillText, { color: isDark ? chrom.mint : chrom.sky }]}>
                    {primaryExpert?.title ?? choicePrompt.specialistLabel}
                  </Text>
                </View>
                {progressText ? (
                  <Text style={[styles.progressText, { color: colors.muted }]}>{progressText}</Text>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.clarifyEyebrow, { color: chrom.mint }]}>Choose an option</Text>
            )}
            {choicePrompt.progress ? (
              <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]}>
                <View
                  style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: chrom.mint }]}
                />
              </View>
            ) : null}
            {choicePrompt.supportingExpertIds.length > 0 ? (
              <View style={styles.supportingExpertsRow}>
                <Text style={[styles.supportingExpertsLabel, { color: colors.muted }]}>Also watching</Text>
                {choicePrompt.supportingExpertIds.slice(0, 3).map((id) => (
                  <ExpertGlyph key={id} expert={expertMap.get(id)} fallbackColor={chrom.sky} size={22} />
                ))}
              </View>
            ) : null}
            <Text style={[styles.clarifyQuestion, { color: colors.primaryTxt }]}>{choicePrompt.question}</Text>
            {choicePrompt.whyItMatters ? (
              <View style={[styles.whyCard, { backgroundColor: colors.pageBg, borderColor: colors.composerBorder }]}>
                <Text style={[styles.whyLabel, { color: chrom.mint }]}>Why this matters</Text>
                <Text style={[styles.whyText, { color: colors.muted }]}>{choicePrompt.whyItMatters}</Text>
              </View>
            ) : null}
            {choicePrompt.helperText ? (
              <Text style={[styles.clarifyHelper, { color: colors.muted }]}>{choicePrompt.helperText}</Text>
            ) : null}

            {isTypingCustomChoice ? (
              <View style={styles.customChoiceRow}>
                <TextInput
                  value={customChoice}
                  onChangeText={setCustomChoice}
                  autoFocus
                  placeholder="Type your answer…"
                  placeholderTextColor={colors.muted}
                  editable={!sending}
                  style={[
                    styles.customChoiceInput,
                    {
                      color: colors.primaryTxt,
                      borderColor: colors.composerBorder,
                      backgroundColor: colors.pageBg,
                    },
                  ]}
                  onSubmitEditing={() => {
                    void handleCustomChoiceSubmit();
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send custom answer"
                  disabled={!customChoice.trim() || sending}
                  onPress={() => {
                    void handleCustomChoiceSubmit();
                  }}
                  style={[styles.customChoiceSend, { backgroundColor: chrom.mint }, (!customChoice.trim() || sending) && { opacity: 0.45 }]}>
                  {sending ? (
                    <ActivityIndicator color={chrom.ctaOnGradient} size="small" />
                  ) : (
                    <Text style={[styles.customChoiceSendText, { color: chrom.ctaOnGradient }]}>Send</Text>
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel custom answer"
                  onPress={() => {
                    setIsTypingCustomChoice(false);
                    setCustomChoice('');
                  }}
                  style={styles.customChoiceCancel}>
                  <Text style={[styles.customChoiceCancelText, { color: colors.muted }]}>Cancel</Text>
                </Pressable>
              </View>
            ) : useRichOptions ? (
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
                    style={[
                      styles.choiceCard,
                      {
                        borderColor: isDark ? `${chrom.mint}45` : `${chrom.sky}45`,
                        backgroundColor: colors.pageBg,
                        opacity: sending ? 0.55 : 1,
                      },
                    ]}>
                    <Text style={[styles.choiceCardLabel, { color: colors.primaryTxt }]}>{option.label}</Text>
                    {option.description ? (
                      <Text style={[styles.choiceCardDesc, { color: colors.muted }]}>{option.description}</Text>
                    ) : null}
                  </Pressable>
                ))}
                {choicePrompt.allowCustomAnswer ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Type another answer"
                    disabled={sending}
                    onPress={() => setIsTypingCustomChoice(true)}
                    style={[
                      styles.choiceCard,
                      {
                        borderColor: colors.composerBorder,
                        backgroundColor: colors.pageBg,
                        opacity: sending ? 0.55 : 1,
                      },
                    ]}>
                    <Text style={[styles.choiceCardLabel, { color: colors.muted }]}>Other — type my own answer</Text>
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
                        opacity: sending ? 0.5 : 1,
                      },
                    ]}>
                    <Text style={[styles.clarifyChipText, { color: isDark ? chrom.mint : chrom.sky }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
                {choicePrompt.allowCustomAnswer ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Type another answer"
                    disabled={sending}
                    onPress={() => setIsTypingCustomChoice(true)}
                    style={[
                      styles.clarifyChip,
                      {
                        borderColor: colors.composerBorder,
                        backgroundColor: colors.pageBg,
                      },
                    ]}>
                    <Text style={[styles.clarifyChipText, { color: colors.muted }]}>Other…</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
            </ScrollView>
          </Animated.View>
        ) : null}

        {!finalReady ? (
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
              value={input}
              onChangeText={setInput}
              placeholder={
                choicePrompt
                  ? 'Or type a custom answer above…'
                  : booting
                    ? 'Connecting…'
                    : messages.length <= 1
                      ? 'e.g. Should I accept this co-op offer?'
                      : 'Add more context…'
              }
              placeholderTextColor={colors.muted}
              editable={!choicePrompt && !booting && !sending && !!sessionId}
              style={[styles.composerInput, { color: colors.primaryTxt }]}
              multiline
              maxFontSizeMultiplier={Platform.OS === 'ios' ? 1.35 : undefined}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              onPress={() => {
                void handleSend();
              }}
              disabled={!input.trim() || booting || !sessionId || sending}
              style={[
                styles.sendCircle,
                { backgroundColor: colors.sendFab },
                (!input.trim() || booting || !sessionId || sending) && styles.sendCircleDisabled,
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
            <Text style={[styles.sheetHint, { color: colors.muted }]}>
              Sessions live in gateway memory until you restart the API.
            </Text>
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
  headerExperts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 6,
  },
  headerProgressTrack: {
    marginTop: 8,
    width: 120,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  headerProgressFill: {
    height: '100%',
    borderRadius: 999,
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
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
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
    fontSize: 13,
    lineHeight: 18,
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
    gap: 8,
  },
  choiceCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 3,
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
});
