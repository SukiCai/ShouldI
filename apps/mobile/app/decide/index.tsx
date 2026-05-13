import { router, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Screen from '@/components/ui/Screen';
import { GlassCard, GradientHero, PillTag } from '@/components/ui/Premium';
import { palette, radius, spacing, typography } from '@/constants/theme';
import type { DecisionCategory } from '@shouldi/contracts';

import { useDecideWizard } from './context';

const options: DecisionCategory[] = ['life', 'career', 'relationship', 'money'];

const readable: Record<DecisionCategory, string> = {
  life: 'Life path',
  career: 'Career move',
  relationship: 'Relationship',
  money: 'Money trade-off',
};

type PromptStep = {
  id: number;
  key: 'category' | 'title' | 'constraints' | 'successCriteria';
  prompt: string;
  placeholder: string;
};

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

const steps: PromptStep[] = [
  {
    id: 0,
    key: 'category',
    prompt: 'What type of decision is this? (life / career / relationship / money)',
    placeholder: 'Type one category…',
  },
  {
    id: 1,
    key: 'title',
    prompt: 'What is the core decision question in one sentence?',
    placeholder: 'Example: Should I accept the remote role with lower salary?',
  },
  {
    id: 2,
    key: 'constraints',
    prompt: 'List concrete constraints (timeline, money, people, legal, energy).',
    placeholder: 'Add constraints…',
  },
  {
    id: 3,
    key: 'successCriteria',
    prompt: 'Optional: what would a good outcome look like in 3 months?',
    placeholder: 'Optional success criteria…',
  },
];

function normalizeCategory(input: string): DecisionCategory | null {
  const cleaned = input.trim().toLowerCase();
  if (!cleaned) return null;
  if (cleaned.includes('career')) return 'career';
  if (cleaned.includes('relationship')) return 'relationship';
  if (cleaned.includes('money')) return 'money';
  if (cleaned.includes('life')) return 'life';
  return null;
}

export default function DecideCategoryScreen() {
  const { draft, updateDraft } = useDecideWizard();
  const params = useLocalSearchParams<{ category?: DecisionCategory }>();
  const [stepIdx, setStepIdx] = React.useState(0);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    { id: 'assistant-0', role: 'assistant', text: steps[0].prompt },
  ]);
  const composerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!params.category) return;
    if (options.includes(params.category)) {
      const prefCategory = params.category;
      updateDraft({ category: prefCategory });
      setMessages((prev) => {
        if (prev.some((m) => m.text.includes('What type of decision'))) {
          return [
            ...prev,
            { id: `user-prefill-${prefCategory}`, role: 'user', text: prefCategory },
            { id: 'assistant-1', role: 'assistant', text: steps[1].prompt },
          ];
        }
        return prev;
      });
      setStepIdx(1);
    }
  }, [params.category, updateDraft]);

  const canComplete = draft.category && draft.title.trim().length > 0;

  const progress = Math.min(stepIdx + 1, steps.length);

  React.useEffect(() => {
    Animated.timing(composerAnim, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [composerAnim, stepIdx]);

  function persistAnswer(currentStep: PromptStep, answer: string) {
    const text = answer.trim();
    if (!text) return;

    if (currentStep.key === 'category') {
      const parsed = normalizeCategory(text);
      if (parsed) {
        updateDraft({ category: parsed });
      } else {
        updateDraft({ category: undefined });
      }
      return;
    }

    if (currentStep.key === 'title') {
      updateDraft({ title: text });
      return;
    }

    if (currentStep.key === 'constraints') {
      updateDraft({ constraints: text });
      return;
    }

    updateDraft({ successCriteria: text });
  }

  function validationError(currentStep: PromptStep): string | null {
    if (currentStep.key === 'category' && !draft.category) {
      return 'Use one of: life, career, relationship, money.';
    }
    if (currentStep.key === 'title' && !draft.title.trim()) {
      return 'Please add a one-line decision question.';
    }
    return null;
  }

  function handleSend() {
    const current = steps[stepIdx];
    if (!current) return;
    if (!input.trim()) return;

    const userText = input.trim();
    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: `user-${current.id}-${messages.length}`, role: 'user', text: userText },
    ];

    persistAnswer(current, userText);

    const errorText = validationError(current);
    if (errorText) {
      setMessages([
        ...nextMessages,
        { id: `assistant-err-${current.id}-${messages.length}`, role: 'assistant', text: errorText },
      ]);
      setInput('');
      return;
    }

    const nextIndex = stepIdx + 1;
    if (nextIndex < steps.length) {
      setMessages([
        ...nextMessages,
        { id: `assistant-${nextIndex}-${messages.length}`, role: 'assistant', text: steps[nextIndex].prompt },
      ]);
      setStepIdx(nextIndex);
      setInput('');
      return;
    }

    setMessages([
      ...nextMessages,
      {
        id: `assistant-done-${messages.length}`,
        role: 'assistant',
        text: 'Done. Tap "Review draft".',
      },
    ]);
    setStepIdx(steps.length);
    setInput('');
  }

  return (
    <Screen padded>
      <GradientHero
        eyebrow="AI intake"
        title="Guided decision chat"
        subtitle="Answer quick prompts. We shape the draft."
        right={<PillTag label={`${progress}/${steps.length}`} tone="brand" />}
      />
      <View style={styles.progressRow}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(progress / steps.length) * 100}%` }]} />
        </View>
      </View>

      <GlassCard style={styles.chatShell}>
        <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.chatList}
        contentContainerStyle={styles.chatContent}
        renderItem={({ item }) => (
          <View style={[styles.messageWrap, item.role === 'user' ? styles.right : styles.left]}>
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
              <Text style={[typography.body, item.role === 'user' ? styles.userText : styles.assistantText]}>
                {item.role === 'assistant' && item.text.toLowerCase().includes('life') ? (
                  <>
                    {item.text}{'\n'}
                    <Text style={styles.chipsHint}>
                      Quick picks:{' '}
                      {options.map((o, idx) => (
                        <Text key={o}>
                          {readable[o]}
                          {idx < options.length - 1 ? ' · ' : ''}
                        </Text>
                      ))}
                    </Text>
                  </>
                ) : (
                  item.text
                )}
              </Text>
            </View>
          </View>
        )}
      />
      </GlassCard>

      {stepIdx < steps.length ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View
            style={[
              styles.composer,
              {
                opacity: composerAnim,
                transform: [
                  {
                    translateY: composerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={steps[stepIdx].placeholder}
              placeholderTextColor={palette.slate500}
              style={styles.input}
              multiline
              accessibilityLabel="Decision intake answer input"
              onSubmitEditing={handleSend}
            />
            <Pressable
              onPress={handleSend}
              disabled={!input.trim()}
              style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Review collected decision draft"
          style={[styles.reviewBtn, !canComplete && styles.sendBtnDisabled]}
          disabled={!canComplete}
          onPress={() => router.push('/decide/confirm')}
        >
          <Text style={styles.reviewBtnText}>Review draft</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginTop: 6,
    color: palette.slate500,
  },
  chatShell: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingVertical: 8,
  },
  progressRow: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: 6,
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.slate100,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: palette.accent,
    borderRadius: 999,
  },
  chatList: {
    flex: 1,
    minHeight: 280,
    maxHeight: 420,
  },
  chatContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  messageWrap: {
    flexDirection: 'row',
  },
  left: {
    justifyContent: 'flex-start',
  },
  right: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  assistantBubble: {
    backgroundColor: palette.accentSoft,
    borderColor: '#d8e2ff',
  },
  userBubble: {
    backgroundColor: palette.white,
    borderColor: '#dfe7fa',
  },
  assistantText: {
    color: palette.slate900,
  },
  userText: {
    color: palette.slate950,
  },
  chipsHint: {
    color: palette.slate500,
    fontSize: 12,
    lineHeight: 18,
  },
  composer: {
    marginTop: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dce6fb',
    backgroundColor: '#fffffffa',
    borderRadius: radius.lg,
    padding: 10,
    gap: 10,
  },
  input: {
    minHeight: 70,
    maxHeight: 140,
    color: palette.slate950,
  },
  sendBtn: {
    alignSelf: 'flex-end',
    backgroundColor: palette.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    color: palette.white,
    fontWeight: '600',
  },
  reviewBtn: {
    marginTop: spacing.sm,
    backgroundColor: palette.accent,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  reviewBtnText: {
    color: palette.white,
    fontWeight: '600',
    fontSize: 16,
  },
});
