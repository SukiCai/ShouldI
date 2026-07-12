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
import JumpUpSheet, { JUMP_UP_SPRING } from '@/components/ui/JumpUpSheet';
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

function resolveQuestionHeadline(question: string, title?: string): string {
  const trimmed = formatBubbleText(question).trim();
  if (trimmed && !isMetaChoiceCopy(trimmed)) return trimmed;
  if (title?.trim()) {
    return `What best describes the ${title.trim().toLowerCase()}?`;
  }
  return 'Which of these fits your situation?';
}

function choicePromptHeadline(prompt: DecideInterviewChoicePrompt): string {
  return resolveQuestionHeadline(prompt.question, prompt.title);
}

function assistantBubbleBody(
  item: DecideInterviewBubble,
  allMessages: DecideInterviewBubble[],
  choicePrompt: DecideInterviewChoicePrompt | null,
  isActiveChoice: boolean,
): string {
  if (isActiveChoice && choicePrompt) {
    return choicePromptHeadline(choicePrompt);
  }
  if (item.question?.trim()) {
    return resolveQuestionHeadline(item.question, item.expertTitle);
  }
  const text = displayAssistantText(item, allMessages);
  if (isMetaChoiceCopy(text)) {
    return resolveQuestionHeadline(text, item.expertTitle);
  }
  const expertTitle = item.expertTitle?.trim();
  if (expertTitle && text.startsWith(`${expertTitle}:`)) {
    return text.slice(expertTitle.length + 1).trim();
  }
  return text;
}

function expertCouncilSummary(verdicts: Array<{ verdictLine: string }>): string | null {
  if (verdicts.length === 0) return null;
  const yes = verdicts.filter((v) => /^yes\b/i.test(v.verdictLine.trim())).length;
  const no = verdicts.filter((v) => /^no\b/i.test(v.verdictLine.trim())).length;
  if (yes === 0 && no === 0) return `${verdicts.length} expert views`;
  return `${verdicts.length} experts · ${yes} yes, ${no} no`;
}

const COUNCIL_GRADIENT_DARK = ['#0c0618', '#1a0f3d', '#0a1628'] as const;
const COUNCIL_GRADIENT_LIGHT = ['#f5f0ff', '#ede9fe', '#dbeafe'] as const;
const COUNCIL_VIOLET = '#8b5cf6';
const COUNCIL_GOLD = '#f59e0b';

function councilVoteTally(verdicts: Array<{ verdictLine: string }>) {
  const yes = verdicts.filter((v) => /^yes\b/i.test(v.verdictLine.trim())).length;
  const no = verdicts.filter((v) => /^no\b/i.test(v.verdictLine.trim())).length;
  return { yes, no, total: verdicts.length };
}

function councilVoteStamp(line: string): 'YES' | 'NO' | 'MIX' {
  const normalized = line.trim().toLowerCase();
  if (normalized.startsWith('yes') || normalized.includes('lean yes')) return 'YES';
  if (normalized.startsWith('no') || normalized.includes('lean no')) return 'NO';
  return 'MIX';
}

function CouncilVoteTally({
  yes,
  no,
  total,
  isDark,
}: {
  yes: number;
  no: number;
  total: number;
  isDark: boolean;
}) {
  if (total === 0) return null;
  return (
    <View style={councilStyles.tallyRow}>
      <View style={[councilStyles.tallyChip, { backgroundColor: isDark ? 'rgba(45,212,191,0.18)' : 'rgba(16,185,129,0.14)' }]}>
        <Ionicons name="checkmark-circle" size={13} color={isDark ? '#5eead4' : '#059669'} />
        <Text style={[councilStyles.tallyChipText, { color: isDark ? '#5eead4' : '#047857' }]}>{yes} Yes</Text>
      </View>
      <View style={[councilStyles.tallyChip, { backgroundColor: isDark ? 'rgba(251,113,133,0.18)' : 'rgba(244,63,94,0.12)' }]}>
        <Ionicons name="close-circle" size={13} color={isDark ? '#fb7185' : '#e11d48'} />
        <Text style={[councilStyles.tallyChipText, { color: isDark ? '#fb7185' : '#be123c' }]}>{no} No</Text>
      </View>
      <View style={[councilStyles.tallyChip, { backgroundColor: isDark ? 'rgba(167,139,250,0.16)' : 'rgba(139,92,246,0.12)' }]}>
        <Ionicons name="people" size={13} color={COUNCIL_VIOLET} />
        <Text style={[councilStyles.tallyChipText, { color: COUNCIL_VIOLET }]}>{total} voices</Text>
      </View>
    </View>
  );
}

const councilStyles = StyleSheet.create({
  tallyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  tallyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  tallyChipText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  chamberStrip: {
    marginBottom: 10,
    marginTop: 4,
  },
  chamberStripGrad: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  chamberStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  chamberIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chamberEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  chamberTitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
});

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

type ExpertJoinRow = {
  id: string;
  expert: DecideInterviewExpert;
  at: number;
  contextText?: string;
};

type DecideThreadItem =
  | { kind: 'message'; id: string; at: number; bubble: DecideInterviewBubble; messageIndex: number }
  | { kind: 'expert-join'; id: string; at: number; expert: DecideInterviewExpert; contextText?: string };

function threadItemKey(item: DecideThreadItem): string {
  return item.id;
}

function buildThreadItems(messages: DecideInterviewBubble[], expertJoinRows: ExpertJoinRow[]): DecideThreadItem[] {
  const rows: DecideThreadItem[] = messages.map((bubble, messageIndex) => ({
    kind: 'message',
    id: bubble.id,
    at: bubble.at,
    bubble,
    messageIndex,
  }));
  for (const join of expertJoinRows) {
    rows.push({
      kind: 'expert-join',
      id: join.id,
      at: join.at,
      expert: join.expert,
      contextText: join.contextText,
    });
  }
  rows.sort((a, b) => {
    if (a.at !== b.at) return a.at - b.at;
    if (a.kind === 'expert-join' && b.kind === 'message') return -1;
    if (a.kind === 'message' && b.kind === 'expert-join') return 1;
    return 0;
  });
  return rows;
}

function joinAnchorAt(merged: DecideInterviewBubble[]): number {
  const lastUser = [...merged].filter((message) => message.role === 'user').at(-1);
  const newestAssistant = [...merged].filter((message) => message.role === 'assistant').at(-1);
  if (lastUser && newestAssistant && lastUser.at < newestAssistant.at) {
    const midpoint = lastUser.at + (newestAssistant.at - lastUser.at) / 2;
    return midpoint > lastUser.at ? midpoint : lastUser.at + 0.5;
  }
  if (lastUser) return lastUser.at + 0.5;
  return (newestAssistant?.at ?? Date.now()) - 0.5;
}

function joinContextForExpert(
  _expert: DecideInterviewExpert,
  _choicePrompt: DecideInterviewChoicePrompt | null | undefined,
  triggerText?: string,
): string | undefined {
  const trimmed = triggerText?.trim();
  if (trimmed) return `Weighing in on “${trimmed}”`;
  return undefined;
}

function appendExpertJoinRows(
  prev: ExpertJoinRow[],
  experts: DecideInterviewExpert[],
  anchorAt: number,
  contextByExpertId: Map<string, string | undefined>,
): ExpertJoinRow[] {
  const seen = new Set(prev.map((row) => row.expert.id));
  const additions = experts
    .filter((expert) => !seen.has(expert.id))
    .map((expert, idx) => ({
      id: `join-${expert.id}-${anchorAt}-${idx}`,
      expert,
      at: anchorAt - idx * 0.01,
      contextText: contextByExpertId.get(expert.id),
    }));
  return additions.length > 0 ? [...prev, ...additions] : prev;
}

function HeaderJoinAvatar({
  expert,
  isNew,
  fallbackColor,
}: {
  expert: DecideInterviewExpert;
  isNew: boolean;
  fallbackColor: string;
}) {
  const scale = React.useRef(new Animated.Value(isNew ? 0.35 : 1)).current;
  const opacity = React.useRef(new Animated.Value(isNew ? 0 : 1)).current;

  React.useEffect(() => {
    if (!isNew) return;
    scale.setValue(0.35);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isNew, opacity, scale]);

  return (
    <Animated.View style={[styles.headerStatusAvatarRing, { opacity, transform: [{ scale }] }]}>
      <ExpertGlyph expert={expert} fallbackColor={fallbackColor} size={18} />
    </Animated.View>
  );
}

const JOIN_CHAT_ENTER_MS = 280;

function ChamberJoinChatRow({
  expert,
  contextText,
  isCouncil,
  isDark,
  colors,
}: {
  expert: DecideInterviewExpert;
  contextText?: string;
  isCouncil: boolean;
  isDark: boolean;
  colors: { primaryTxt: string; muted: string; composerBorder: string };
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(10)).current;
  const scale = React.useRef(new Animated.Value(0.96)).current;

  React.useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(10);
    scale.setValue(0.96);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        ...JUMP_UP_SPRING,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: JOIN_CHAT_ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [expert.id, opacity, scale, translateY]);

  const accentColor = expert.color ?? COUNCIL_VIOLET;
  const cardInner = (
    <>
      <View style={[styles.chamberJoinChatAccent, { backgroundColor: accentColor }]} />
      <ExpertGlyph expert={expert} fallbackColor={accentColor} size={30} />
      <View style={styles.chamberJoinChatCopy}>
        {isCouncil ? (
          <View style={styles.chamberJoinChatKickerRow}>
            <Ionicons name="sparkles" size={10} color={COUNCIL_GOLD} />
            <Text style={[styles.chamberJoinChatKicker, { color: COUNCIL_GOLD }]}>ENTERED THE CHAMBER</Text>
          </View>
        ) : (
          <Text style={[styles.chamberJoinChatKicker, { color: colors.muted }]}>JOINED THE CONVERSATION</Text>
        )}
        <Text
          style={[
            styles.chamberJoinChatTitle,
            { color: isCouncil ? (isDark ? '#faf5ff' : '#3b0764') : colors.primaryTxt },
          ]}
          numberOfLines={1}>
          {expert.title}
        </Text>
        {contextText ? (
          <Text
            style={[
              styles.chamberJoinChatDetail,
              { color: isCouncil ? (isDark ? '#ddd6fe' : '#6d28d9') : colors.muted },
            ]}
            numberOfLines={3}>
            {contextText}
          </Text>
        ) : null}
      </View>
      {isCouncil ? <Ionicons name="sparkles" size={16} color={COUNCIL_GOLD} /> : null}
    </>
  );

  return (
    <View style={[styles.chamberJoinChatRow, styles.msgPadH]}>
      <Animated.View style={{ opacity, transform: [{ translateY }, { scale }], width: '100%', maxWidth: 420 }}>
        {isCouncil ? (
          <LinearGradient
            colors={
              isDark
                ? ['rgba(91, 33, 182, 0.55)', 'rgba(109, 40, 217, 0.38)']
                : ['#ddd6fe', '#c4b5fd']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.chamberJoinChatCard, styles.chamberJoinChatCardCouncil, { borderColor: `${COUNCIL_VIOLET}66` }]}>
            {cardInner}
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.chamberJoinChatCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                borderColor: colors.composerBorder,
              },
            ]}>
            {cardInner}
          </View>
        )}
      </Animated.View>
    </View>
  );
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
  const isCouncil = mode === 'complex';
  const councilTheme = React.useMemo(
    () => ({
      violet: COUNCIL_VIOLET,
      gold: COUNCIL_GOLD,
      headerGrad: (isDark ? COUNCIL_GRADIENT_DARK : COUNCIL_GRADIENT_LIGHT) as readonly [string, string, string],
      verdictGrad: (isDark
        ? ['#0c0618', '#1e1040', '#0f172a']
        : ['#ede9fe', '#f8fafc', '#dbeafe']) as readonly [string, string, string],
      accent: isCouncil ? COUNCIL_VIOLET : chrom.mint,
    }),
    [chrom.mint, isCouncil, isDark],
  );
  const councilTally = finalDecision ? councilVoteTally(finalDecision.expertVerdicts) : null;
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
    isCouncil && verdictWord === 'YES'
      ? '#34d399'
      : isCouncil && verdictWord === 'NO'
        ? '#fb7185'
        : isCouncil
          ? COUNCIL_VIOLET
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
  const showCompactHeader = modeLocked || sessionStarted || hasUserMessages;
  const headerStatusLine = React.useMemo(() => {
    if (!showCompactHeader) return null;
    if (isCouncil) {
      const expertPart =
        activeExperts.length > 0
          ? `${activeExperts.length} expert${activeExperts.length === 1 ? '' : 's'}`
          : 'Assembling council';
      return progressText ? `${expertPart} · ${progressText}` : expertPart;
    }
    if (primaryExpert?.title) return primaryExpert.title;
    return progressText ?? subtitle;
  }, [
    activeExperts.length,
    isCouncil,
    primaryExpert?.title,
    progressText,
    showCompactHeader,
    subtitle,
  ]);
  const threadItems = React.useMemo(
    () => buildThreadItems(messages, expertJoinRows),
    [expertJoinRows, messages],
  );

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
                borderColor: isCouncil
                  ? isDark
                    ? `${COUNCIL_VIOLET}50`
                    : `${COUNCIL_VIOLET}40`
                  : isDark
                    ? `${chrom.mint}40`
                    : `${chrom.sky}50`,
                backgroundColor: pressed
                  ? isCouncil
                    ? isDark
                      ? `${COUNCIL_VIOLET}22`
                      : `${COUNCIL_VIOLET}16`
                    : isDark
                      ? `${chrom.mint}20`
                      : `${chrom.sky}18`
                  : isCouncil
                    ? isDark
                      ? `${COUNCIL_VIOLET}12`
                      : `${COUNCIL_VIOLET}0A`
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
            <Ionicons name="chevron-forward" size={16} color={isCouncil ? COUNCIL_VIOLET : isDark ? chrom.mint : chrom.sky} />
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
            isCouncil && styles.choicePanelCouncil,
            {
              borderColor: isCouncil
                ? isDark
                  ? `${COUNCIL_VIOLET}45`
                  : `${COUNCIL_VIOLET}35`
                : isDark
                  ? `${chrom.mint}30`
                  : `${chrom.sky}35`,
              backgroundColor: isCouncil
                ? isDark
                  ? `${COUNCIL_VIOLET}10`
                  : `${COUNCIL_VIOLET}08`
                : isDark
                  ? `${chrom.mint}08`
                  : `${chrom.sky}06`,
            },
          ]}>
          {isCouncil ? (
            <View style={styles.councilChoiceEyebrow}>
              <Ionicons name="chatbubbles" size={12} color={COUNCIL_VIOLET} />
              <Text style={[styles.councilChoiceEyebrowText, { color: COUNCIL_VIOLET }]}>Council question</Text>
            </View>
          ) : null}
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
          colors={isCouncil ? councilTheme.headerGrad : isDark ? PROFILE_HERO_GRADIENT_DARK : PROFILE_HERO_GRADIENT_LIGHT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {isCouncil ? (
          <LinearGradient
            colors={isDark ? ['rgba(139,92,246,0.22)', 'transparent', 'rgba(245,158,11,0.08)'] : ['rgba(139,92,246,0.12)', 'transparent', 'rgba(245,158,11,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
        ) : null}
        <View style={styles.headerTopRow}>
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
              <Text style={[styles.agentTitle, { color: chrom.display }]} numberOfLines={1}>
                {headerTitle}
              </Text>
              {isCouncil && isPremium ? (
                <View style={[styles.councilPremiumPip, { borderColor: `${COUNCIL_GOLD}88`, backgroundColor: `${COUNCIL_GOLD}22` }]}>
                  <Ionicons name="star" size={9} color={COUNCIL_GOLD} />
                </View>
              ) : null}
              <View
                style={[
                  styles.liveDot,
                  { backgroundColor: hermesIntegrated ? (isCouncil ? COUNCIL_VIOLET : chrom.mint) : chrom.textMuted },
                ]}
              />
            </View>

            {showCompactHeader && headerStatusLine ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Session status: ${headerStatusLine}`}
                onPress={() => {
                  if (activeExperts.length > 0) setExpertsOpen(true);
                }}
                style={[
                  styles.headerStatusPill,
                  {
                    backgroundColor: isCouncil
                      ? isDark
                        ? 'rgba(139,92,246,0.16)'
                        : 'rgba(139,92,246,0.1)'
                      : isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(15,23,42,0.05)',
                    borderColor: isCouncil ? `${COUNCIL_VIOLET}33` : colors.composerBorder,
                  },
                ]}>
                {activeExperts.length > 0 ? (
                  <View style={styles.headerStatusAvatars}>
                    {activeExperts.slice(0, 3).map((expert, idx) => (
                      <View key={expert.id} style={idx > 0 ? styles.headerStatusAvatarOverlap : null}>
                        <HeaderJoinAvatar
                          expert={expert}
                          isNew={recentJoinExpertIds.has(expert.id)}
                          fallbackColor={isCouncil ? COUNCIL_VIOLET : chrom.mint}
                        />
                      </View>
                    ))}
                  </View>
                ) : isCouncil ? (
                  <Ionicons name="people-outline" size={14} color={COUNCIL_VIOLET} />
                ) : null}
                <Text style={[styles.headerStatusText, { color: chrom.textMuted }]} numberOfLines={1}>
                  {headerStatusLine}
                </Text>
                {activeExperts.length > 0 ? (
                  <Ionicons name="chevron-down" size={12} color={chrom.textMuted} />
                ) : null}
              </Pressable>
            ) : (
              <>
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
                        mode === 'complex' && styles.headerModeBtnCouncilActive,
                        !isPremium && mode !== 'complex' && !canAccessCouncil && styles.headerModeBtnLocked,
                      ]}>
                      {mode === 'complex' ? (
                        <LinearGradient
                          colors={isDark ? ['#4c1d95', '#6d28d9', '#7c3aed'] : ['#c4b5fd', '#a78bfa', '#8b5cf6']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[StyleSheet.absoluteFillObject, { borderRadius: 8 }]}
                        />
                      ) : null}
                      <View style={styles.headerModeBtnInner}>
                        {!isPremium && mode !== 'complex' ? (
                          <Ionicons
                            name={canAccessCouncil ? 'diamond-outline' : 'lock-closed'}
                            size={11}
                            color={chrom.textMuted}
                          />
                        ) : isPremium ? (
                          <Ionicons name="star" size={11} color={mode === 'complex' ? '#fff' : chrom.textMuted} />
                        ) : null}
                        <Text
                          style={[
                            styles.headerModeBtnText,
                            { color: mode === 'complex' ? '#fff' : chrom.textMuted },
                          ]}>
                          Council
                        </Text>
                        {!isPremium && mode !== 'complex' ? (
                          <View style={[styles.headerModeCostPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)' }]}>
                            <Text style={[styles.headerModeCost, { color: chrom.textMuted }]}>{councilSessionCost}</Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  </View>
                ) : null}
              </>
            )}
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
        {showCompactHeader && choicePrompt?.progress ? (
          <View style={[styles.headerProgressEdge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]}>
            <View
              style={[
                styles.headerProgressEdgeFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: isCouncil ? COUNCIL_VIOLET : chrom.mint,
                },
              ]}
            />
          </View>
        ) : null}
      </View>

      {booting ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={chrom.mint} size="large" />
          <Text style={[styles.loadingLabel, { color: colors.muted }]}>Loading…</Text>
        </View>
      ) : finalReady && finalDecision ? (
        <View style={styles.verdictScreen}>
          <LinearGradient
            colors={isCouncil ? councilTheme.verdictGrad : isDark ? ['#050816', '#0F172A', '#062B2F'] : ['#E0F2FE', '#F8FAFC', '#D1FAE5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {isCouncil ? (
            <LinearGradient
              colors={isDark ? ['rgba(139,92,246,0.2)', 'transparent', 'rgba(245,158,11,0.1)'] : ['rgba(139,92,246,0.14)', 'transparent', 'rgba(245,158,11,0.08)']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
          ) : null}
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
              colors={
                isCouncil
                  ? isDark
                    ? [COUNCIL_VIOLET, '#6d28d9', COUNCIL_GOLD]
                    : ['#a78bfa', COUNCIL_VIOLET, '#fbbf24']
                  : isDark
                    ? [verdictAccent, chrom.sky]
                    : [chrom.sky, verdictAccent]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.verdictOrbGradient}>
              <Ionicons
                name={
                  isCouncil
                    ? 'people'
                    : verdictWord === 'NO'
                      ? 'shield-outline'
                      : 'sparkles'
                }
                size={34}
                color={chrom.ctaOnGradient}
              />
            </LinearGradient>
          </Animated.View>
          <Text style={[styles.verdictKicker, { color: isCouncil ? COUNCIL_GOLD : verdictAccent }]}>
            {isCouncil ? 'Council verdict' : 'Harmence decision'}
          </Text>
          <Text style={[styles.verdictWord, { color: verdictAccent }]}>{verdictWord}</Text>
          <Text style={[styles.verdictSentence, { color: colors.primaryTxt }]}>
            {finalDecision.verdictLine}
          </Text>
          {isCouncil && councilTally && councilTally.total > 0 ? (
            <CouncilVoteTally yes={councilTally.yes} no={councilTally.no} total={councilTally.total} isDark={isDark} />
          ) : councilSummary ? (
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
              <Text style={[styles.councilSectionLabel, { color: COUNCIL_VIOLET }]}>Individual votes</Text>
              {finalDecision.expertVerdicts.map((verdict) => {
                const expert = expertMap.get(verdict.expertId);
                const stamp = councilVoteStamp(verdict.verdictLine);
                const stampColor =
                  stamp === 'YES' ? (isDark ? '#34d399' : '#059669') : stamp === 'NO' ? (isDark ? '#fb7185' : '#e11d48') : COUNCIL_VIOLET;
                return (
                  <View
                    key={verdict.expertId}
                    style={[
                      styles.expertVerdictCard,
                      isCouncil && styles.expertVerdictCardCouncil,
                      {
                        borderColor: isCouncil ? `${expert?.color ?? COUNCIL_VIOLET}44` : colors.composerBorder,
                        backgroundColor: isCouncil
                          ? isDark
                            ? 'rgba(255,255,255,0.04)'
                            : 'rgba(255,255,255,0.92)'
                          : colors.composerBg,
                      },
                    ]}>
                    <View style={[styles.expertVerdictAccent, { backgroundColor: expert?.color ?? COUNCIL_VIOLET }]} />
                    <View style={styles.expertVerdictCardBody}>
                      <View style={styles.expertVerdictHead}>
                        <ExpertGlyph expert={expert} fallbackColor={COUNCIL_VIOLET} size={30} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.expertVerdictTitle, { color: colors.primaryTxt }]}>
                            {verdict.expertTitle}
                          </Text>
                          <Text style={[styles.expertVerdictLine, { color: expert?.color ?? verdictAccent }]}>
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
          data={threadItems}
          keyExtractor={threadItemKey}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            {
              flexGrow: 1,
              paddingBottom: showAnswerPane ? spacing.sm : bottomPad + 72,
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
                  label={isCouncil ? 'Council is deliberating…' : 'Harmence is thinking…'}
                  accent={isCouncil ? COUNCIL_VIOLET : chrom.mint}
                  muted={colors.muted}
                />
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
          renderItem={({ item }) => {
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
            const index = item.messageIndex;
            return bubble.role === 'assistant' ? (
              <View style={[styles.rowAssistant, styles.msgPadH]}>
                <View style={styles.assistantLeading}>
                  <ExpertGlyph expert={expertForBubble(bubble)} fallbackColor={colors.sparklesGlyph} />
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
                    {expertForBubble(bubble) ? (
                      <Text style={[styles.bubbleExpertTitle, { color: expertForBubble(bubble)?.color ?? chrom.mint }]}>
                        {expertForBubble(bubble)?.title}
                      </Text>
                    ) : null}
                    <Text selectable style={[styles.msgTextAssistant, { color: colors.primaryTxt }]}>
                      {assistantBubbleBody(bubble, messages, choicePrompt, index === activeChoiceMessageIndex)}
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
              paddingBottom: bottomPad,
              backgroundColor: colors.pageBg,
              borderTopColor: colors.headerHairline,
            },
          ]}>
        {showStarterLaunchPad ? (
          <View style={[styles.launchPad, styles.msgPadH]}>
            {isCouncil ? (
              <LinearGradient
                colors={isDark ? ['#2e1065aa', '#4c1d95aa'] : ['#ede9fe', '#ddd6fe']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.councilLaunchCard}>
                <View style={styles.councilLaunchInner}>
                  <Ionicons name="people-circle" size={22} color={COUNCIL_VIOLET} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.councilLaunchTitle, { color: isDark ? '#f5f3ff' : '#312e81' }]}>
                      {isPremium ? 'Premium Expert Council' : 'Expert Council'}
                    </Text>
                    <Text style={[styles.councilLaunchSub, { color: colors.muted }]}>
                      {isPremium
                        ? 'Multiple specialists debate your case — each vote revealed at the end.'
                        : `${councilSessionCost} points per session · each specialist votes at the end.`}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
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

      <JumpUpSheet
        visible={sessionsOpen}
        onClose={() => setSessionsOpen(false)}
        backgroundColor={colors.modalBg}
        borderTopColor={colors.composerBorder}
        bottomInset={bottomPad}
        grabColor={isDark ? profileNeutralStroke(0.38) : profileNeutralStroke(0.22)}>
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
      </JumpUpSheet>

      <JumpUpSheet
        visible={expertsOpen}
        onClose={() => setExpertsOpen(false)}
        backgroundColor={colors.modalBg}
        borderTopColor={colors.composerBorder}
        bottomInset={bottomPad}
        grabColor={isDark ? profileNeutralStroke(0.38) : profileNeutralStroke(0.22)}>
        {isCouncil ? (
          <>
            <View style={[styles.councilSheetHeader, { borderBottomColor: colors.composerBorder }]}>
              <View style={styles.councilSheetHeaderMain}>
                <View style={[styles.councilSheetIconWrap, { backgroundColor: `${COUNCIL_VIOLET}18` }]}>
                  <Ionicons name="people-circle" size={24} color={COUNCIL_VIOLET} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.councilSheetTitle, { color: colors.primaryTxt }]}>Council chamber</Text>
                  <Text style={[styles.councilSheetSub, { color: colors.muted }]}>
                    {activeExperts.length} specialist{activeExperts.length === 1 ? '' : 's'} consulted on this decision
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close council roster"
                hitSlop={10}
                onPress={() => setExpertsOpen(false)}
                style={[
                  styles.councilSheetClose,
                  {
                    borderColor: colors.composerBorder,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                  },
                ]}>
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.councilExpertList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {activeExperts.map((expert) => (
                <View
                  key={expert.id}
                  style={[
                    styles.councilExpertCard,
                    {
                      borderColor: `${expert.color ?? COUNCIL_VIOLET}33`,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : palette.white,
                    },
                  ]}>
                  <View style={[styles.councilExpertAccent, { backgroundColor: expert.color ?? COUNCIL_VIOLET }]} />
                  <ExpertGlyph expert={expert} fallbackColor={COUNCIL_VIOLET} size={42} />
                  <View style={styles.councilExpertBody}>
                    <Text style={[styles.councilExpertTitle, { color: colors.primaryTxt }]}>{expert.title}</Text>
                    {expert.subtitle ? (
                      <Text style={[styles.councilExpertSub, { color: colors.muted }]} numberOfLines={3}>
                        {expert.subtitle}
                      </Text>
                    ) : expert.skillName ? (
                      <Text style={[styles.councilExpertSub, { color: colors.muted }]} numberOfLines={2}>
                        {expert.skillName}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        ) : (
          <>
            <View style={styles.sheetHeadRow}>
              <Text style={[styles.sheetTitle, { color: colors.primaryTxt }]}>Active expert</Text>
              <Pressable hitSlop={12} onPress={() => setExpertsOpen(false)} accessibilityRole="button">
                <Text style={[styles.sheetClose, { color: colors.muted }]}>Done</Text>
              </Pressable>
            </View>
            <Text style={[styles.sheetHint, { color: colors.muted }]}>
              The specialist helping with your decision.
            </Text>
            <ScrollView contentContainerStyle={styles.sheetList} keyboardShouldPersistTaps="handled">
              {activeExperts.map((expert) => (
                <View key={expert.id} style={[styles.sheetRow, { borderBottomColor: colors.composerBorder }]}>
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
          </>
        )}
      </JumpUpSheet>

      <JumpUpSheet
        visible={councilPaywallOpen}
        onClose={() => setCouncilPaywallOpen(false)}
        backgroundColor="transparent"
        borderTopColor={`${COUNCIL_VIOLET}44`}
        bottomInset={bottomPad}
        maxHeight="88%"
        grabColor={isDark ? profileNeutralStroke(0.38) : profileNeutralStroke(0.22)}
        cardStyle={styles.paywallSheetCard}>
        <LinearGradient
          colors={isDark ? ['#1e1040', '#312e81', '#0f172a'] : ['#f5f3ff', '#ede9fe', '#e0f2fe']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.paywallSheetInner}>
            <View style={[styles.paywallIconWrap, { backgroundColor: `${COUNCIL_VIOLET}22` }]}>
              <Ionicons name="people-circle" size={32} color={COUNCIL_VIOLET} />
            </View>
            <Text style={[styles.paywallKicker, { color: COUNCIL_GOLD }]}>PREMIUM FEATURE</Text>
            <Text style={[styles.paywallTitle, { color: colors.primaryTxt }]}>Expert Council</Text>
            <Text style={[styles.paywallBody, { color: colors.muted }]}>
              A chamber of specialists debates your decision. You see every vote, risk, and rationale before the final
              verdict.
            </Text>
            <View style={styles.paywallFeatureList}>
              {[
                { icon: 'people' as const, text: 'Multiple expert perspectives' },
                { icon: 'git-compare' as const, text: 'Individual yes / no votes' },
                { icon: 'shield-checkmark' as const, text: 'Risks surfaced per expert' },
              ].map((feat) => (
                <View key={feat.text} style={styles.paywallFeatureRow}>
                  <View style={styles.paywallFeatureIcon}>
                    <Ionicons name={feat.icon} size={15} color={COUNCIL_VIOLET} />
                  </View>
                  <Text style={[styles.paywallFeatureText, { color: colors.primaryTxt }]}>{feat.text}</Text>
                </View>
              ))}
            </View>
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
              style={styles.paywallPrimaryWrap}>
              <LinearGradient
                colors={isDark ? ['#7c3aed', '#6d28d9', '#4c1d95'] : ['#a78bfa', '#8b5cf6', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.paywallPrimary}>
                <Ionicons name="star" size={16} color="#fff" />
                <Text style={[styles.paywallPrimaryText, { color: '#fff' }]} numberOfLines={1}>
                  Get Premium
                </Text>
                <Text style={[styles.paywallPrimarySub, { color: 'rgba(255,255,255,0.88)' }]}>unlimited</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Use ${councilSessionCost} points for this council session`}
              disabled={!canUseCouncilWithPoints}
              onPress={() => activateCouncilMode('points')}
              style={[
                styles.paywallSecondary,
                {
                  borderColor: `${COUNCIL_VIOLET}44`,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
                  opacity: canUseCouncilWithPoints ? 1 : 0.45,
                },
              ]}>
              <Ionicons name="diamond-outline" size={16} color={COUNCIL_VIOLET} />
              <Text style={[styles.paywallSecondaryText, { color: colors.primaryTxt }]} numberOfLines={1}>
                Use {councilSessionCost} points
              </Text>
              <Text style={[styles.paywallSecondarySub, { color: colors.muted }]}>one session</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Not now"
              onPress={() => setCouncilPaywallOpen(false)}
              style={styles.paywallDismiss}>
              <Text style={[styles.paywallDismissText, { color: colors.muted }]}>Not now</Text>
            </Pressable>
            {__DEV__ ? (
              <View style={styles.paywallDevRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add 1000 dev test points"
                  onPress={() => {
                    grantDevPoints();
                    setCouncilPaywallOpen(false);
                  }}
                  style={[styles.paywallDevBtn, { borderColor: `${COUNCIL_VIOLET}44` }]}>
                  <Text style={[styles.paywallDevBtnText, { color: COUNCIL_VIOLET }]}>+1,000 pts (dev)</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Activate Premium for dev testing"
                  onPress={() => {
                    void activatePremium();
                    setCouncilPaywallOpen(false);
                  }}
                  style={[styles.paywallDevBtn, { borderColor: `${COUNCIL_GOLD}66` }]}>
                  <Text style={[styles.paywallDevBtnText, { color: COUNCIL_GOLD }]}>Premium (dev)</Text>
                </Pressable>
              </View>
            ) : null}
        </LinearGradient>
      </JumpUpSheet>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'column',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 6,
    minHeight: 48,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  headerTitleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    maxWidth: '100%',
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
  headerStatusAvatarRing: {
    borderRadius: 99,
  },
  headerStatusAvatarOverlap: {
    marginLeft: -6,
  },
  headerStatusText: {
    flexShrink: 1,
    fontSize: 12,
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
  councilTitleBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  councilPremiumPip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
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
    overflow: 'hidden',
  },
  headerModeBtnCouncilActive: {
    borderColor: 'rgba(139,92,246,0.55)',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
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
  headerModeCostPill: {
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
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
    overflow: 'hidden',
    flexDirection: 'row',
  },
  expertVerdictCardCouncil: {
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
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
    fontSize: 11,
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
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
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
  councilLaunchCard: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  councilLaunchInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  councilLaunchTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  councilLaunchSub: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
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
  choicePanelCouncil: {
    borderWidth: 1.5,
  },
  councilChoiceEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: -2,
  },
  councilChoiceEyebrowText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
  chamberJoinChatRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  chamberJoinChatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingRight: 12,
    paddingVertical: 11,
    alignSelf: 'center',
    width: '100%',
  },
  chamberJoinChatCardCouncil: {
    borderWidth: 1.5,
    shadowColor: COUNCIL_VIOLET,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  chamberJoinChatAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  chamberJoinChatCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  chamberJoinChatKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chamberJoinChatKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  chamberJoinChatTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  chamberJoinChatDetail: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
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
  councilSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: screenContentGutter,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  councilSheetHeaderMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  councilSheetIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  councilSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  councilSheetSub: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  councilSheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  councilExpertList: {
    paddingHorizontal: screenContentGutter,
    paddingTop: 14,
    paddingBottom: spacing.sm,
    gap: 10,
  },
  councilExpertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingRight: 14,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  councilExpertAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  councilExpertBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  councilExpertTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  councilExpertSub: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
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
  paywallSheetCard: {
    overflow: 'hidden',
  },
  paywallSheetInner: {
    paddingHorizontal: 22,
    paddingBottom: 8,
    gap: 12,
    alignItems: 'stretch',
  },
  paywallKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    alignSelf: 'center',
  },
  paywallIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    alignSelf: 'center',
  },
  paywallTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    alignSelf: 'center',
  },
  paywallBody: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: 320,
  },
  paywallBalance: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    alignSelf: 'center',
  },
  paywallFeatureList: {
    width: '100%',
    gap: 10,
    marginVertical: 4,
    paddingHorizontal: 4,
  },
  paywallFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  paywallFeatureIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  paywallFeatureText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  paywallPrimaryWrap: {
    width: '100%',
    marginTop: 4,
  },
  paywallPrimary: {
    width: '100%',
    minHeight: 48,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
  },
  paywallPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
  },
  paywallPrimarySub: {
    fontSize: 13,
    fontWeight: '600',
  },
  paywallSecondary: {
    width: '100%',
    minHeight: 46,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
  },
  paywallSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
  },
  paywallSecondarySub: {
    fontSize: 13,
    fontWeight: '500',
  },
  paywallDismiss: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  paywallDismissText: {
    fontSize: 14,
    fontWeight: '600',
  },
  paywallDevRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    paddingBottom: 8,
  },
  paywallDevBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  paywallDevBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
