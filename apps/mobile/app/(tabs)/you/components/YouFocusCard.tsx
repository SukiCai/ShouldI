import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';

import { semantic } from '@/constants/theme';
import type { DecisionRecord } from '@shouldi/contracts';

import { youScreenStyles as styles } from './youScreenStyles';

type YouFocusCardProps = {
  latestDecision?: DecisionRecord;
  communityPostCount: number;
  textDisplay: string;
  textMuted: string;
  groupedSurface: string;
  groupedBorder: string;
};

type FocusAction = {
  title: string;
  body: string;
  ctaLabel: string;
  onPress: () => void;
};

function resolveFocusAction({
  latestDecision,
  communityPostCount,
}: Pick<YouFocusCardProps, 'latestDecision' | 'communityPostCount'>): FocusAction {
  if (!latestDecision && communityPostCount === 0) {
    return {
      title: 'Start with one real decision',
      body: 'Decide, then ask the community or log an outcome.',
      ctaLabel: 'Open Decide',
      onPress: () => router.replace('/(tabs)/decide'),
    };
  }

  if (latestDecision) {
    const questionPreview =
      latestDecision.question.length > 64
        ? `${latestDecision.question.slice(0, 64).trim()}…`
        : latestDecision.question;
    return {
      title: 'Log how it played out',
      body: questionPreview,
      ctaLabel: 'Open Outcome Replay',
      onPress: () =>
        router.push({
          pathname: '/outcome-replay/[id]',
          params: { id: latestDecision.id },
        }),
    };
  }

  return {
    title: 'Watch peer signal come in',
    body: 'Your post is live on Explore — return for votes and reactions.',
    ctaLabel: 'Open Explore',
    onPress: () => router.replace('/(tabs)/explore'),
  };
}

export function YouFocusCard(props: YouFocusCardProps) {
  const action = resolveFocusAction(props);

  return (
    <View
      style={[
        styles.focusCard,
        {
          backgroundColor: props.groupedSurface,
          borderColor: props.groupedBorder,
        },
      ]}>
      <Text style={[styles.sectionLabel, { color: props.textMuted }]}>Next step</Text>
      <Text style={[styles.focusTitle, { color: props.textDisplay }]}>{action.title}</Text>
      <Text style={[styles.focusBody, { color: props.textMuted }]}>{action.body}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.ctaLabel}
        onPress={action.onPress}
        style={[styles.focusPrimaryBtn, { backgroundColor: semantic.actionPrimary }]}>
        <Text style={styles.focusPrimaryBtnText}>{action.ctaLabel}</Text>
      </Pressable>
    </View>
  );
}
