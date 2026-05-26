import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import { apiGetJson, apiPostJson, GATEWAY_ORIGIN } from '@/lib/api';
import type { DecisionCategory } from '@shouldi/contracts';
import {
  DecideInterviewSessionDetailSchema,
  DecideInterviewSessionsListSchema,
  DecideInterviewTurnRequestSchema,
  DecideInterviewTurnResponseSchema,
  type DecideInterviewBubble,
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

  const listRef = React.useRef<FlatList>(null);
  const draftRef = React.useRef(draft);
  draftRef.current = draft;

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
      setMessages((prev) => mergeDeduped(prev, parsed.bubbles));

      if (parsed.isComplete && parsed.suggestedDraftHints) {
        const h = parsed.suggestedDraftHints;
        const d = draftRef.current;
        updateDraft({
          category: h.category ?? d.category,
          title: h.title?.trim()?.length ? h.title.trim() : d.title,
          constraints: h.constraints?.trim()
            ? [d.constraints, h.constraints.trim()].filter(Boolean).join('\n\n')
            : d.constraints,
          successCriteria:
            h.successCriteria?.trim()?.length ? h.successCriteria.trim() : d.successCriteria,
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
        const payload = await apiPostJson('/v1/harmence/interview/turn', DecideInterviewTurnRequestSchema.parse({}));
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
  }, [applyTurnPayload]);

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
      setMessages([...detail.bubbles].sort((a, b) => a.at - b.at));
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
    setError(null);
    setBooting(true);
    void (async () => {
      try {
        const payload = await apiPostJson('/v1/harmence/interview/turn', DecideInterviewTurnRequestSchema.parse({}));
        applyTurnPayload(payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Harmence unreachable');
      } finally {
        setBooting(false);
      }
    })();
  }, [applyTurnPayload]);

  const handleSend = async () => {
    if (!sessionId || !input.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const payload = await apiPostJson(
        `/v1/harmence/interview/turn`,
        DecideInterviewTurnRequestSchema.parse({
          sessionId,
          userText: input.trim(),
        }),
      );
      setInput('');
      applyTurnPayload(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const canReview = !!(draft.category && draft.title.trim().length > 0);

  const subtitle = draft.category ? readable[draft.category] : 'Intake assistant';

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
            <Text style={[styles.agentTitle, { color: chrom.display }]}>Harmence</Text>
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
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={bubbleKey}
          style={styles.list}
          contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) =>
            item.role === 'assistant' ? (
              <View style={[styles.rowAssistant, styles.msgPadH]}>
                <View style={styles.assistantLeading}>
                  <View
                    style={[
                      styles.glyphCircle,
                      {
                        backgroundColor: isDark ? `${chrom.mint}26` : `${chrom.sky}1a`,
                        borderColor: isDark ? `${chrom.mint}38` : `${chrom.sky}50`,
                      },
                    ]}>
                    <Ionicons name="sparkles-outline" size={16} color={colors.sparklesGlyph} />
                  </View>
                </View>
                <View
                  style={[
                    styles.assistantBubble,
                    {
                      backgroundColor: colors.assistantBubbleBg,
                      borderColor: colors.assistantBubbleBorder,
                    },
                  ]}>
                  <Text selectable style={[styles.msgTextAssistant, { color: colors.primaryTxt }]}>
                    {item.text}
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
            <Text style={[styles.softHint, { color: colors.muted }]} numberOfLines={2}>
              {draft.category ? 'Keep answering so we can synthesize your draft.' : 'Optionally choose a preset in Explore to anchor domain.'}
            </Text>
          </View>
        )}

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
            placeholder={booting ? 'Connecting…' : 'Message Harmence…'}
            placeholderTextColor={colors.muted}
            editable={!booting && !sending && !!sessionId}
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
      </View>

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
  msgTextUser: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
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
    alignItems: 'center',
    marginBottom: 2,
    minHeight: 32,
    justifyContent: 'center',
  },
  softHint: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 8,
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
});
