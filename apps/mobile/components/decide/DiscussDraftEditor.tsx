import * as React from 'react';
import { StyleSheet, View } from 'react-native';

import { ExploreCardAiLeanEditor } from '@/components/explore/ExploreCardAiLeanEditor';
import { ExploreDecisionCard } from '@/components/explore/ExploreDecisionCard';
import type { DiscussDraftPollOption } from '@/app/(tabs)/decide/context';
import type { DecisionCategory, DecideInterviewFinalDecision } from '@shouldi/contracts';

export type DiscussDraftFields = {
  category?: DecisionCategory;
  title: string;
  hook: string;
  tension: string;
  communityChallengeQuestion: string;
  communityAiVerdictLine: string;
  communityAiBecause: string;
  pollOptions: DiscussDraftPollOption[];
  aiSuggestedOptionId: string;
  aiConfidenceScore?: number;
  rewardPoints: number;
  expertVerdicts: DecideInterviewFinalDecision['expertVerdicts'];
  keyMoments?: DecideInterviewFinalDecision['keyMoments'];
};

type Props = {
  draft: DiscussDraftFields;
  onChange(patch: Partial<DiscussDraftFields>): void;
};

export function DiscussDraftEditor({ draft, onChange }: Props) {
  const pollQuestion = draft.communityChallengeQuestion.trim() || draft.title.trim();
  const aiLeanId = draft.aiSuggestedOptionId || draft.pollOptions[0]?.id || 'yes';

  const updatePollOption = (optionId: string, label: string) => {
    onChange({
      pollOptions: draft.pollOptions.map((option) => (option.id === optionId ? { ...option, label } : option)),
    });
  };

  const addPollOption = () => {
    if (draft.pollOptions.length >= 4) return;
    const id = `option_${Date.now()}`;
    onChange({
      pollOptions: [...draft.pollOptions, { id, label: '' }],
    });
  };

  const removePollOption = (optionId: string) => {
    if (draft.pollOptions.length <= 2) return;
    const next = draft.pollOptions.filter((option) => option.id !== optionId);
    const patch: Partial<DiscussDraftFields> = { pollOptions: next };
    if (draft.aiSuggestedOptionId === optionId) {
      patch.aiSuggestedOptionId = next[0]?.id ?? draft.aiSuggestedOptionId;
    }
    onChange(patch);
  };

  const reorderPollOptions = (next: DiscussDraftPollOption[]) => {
    onChange({ pollOptions: next });
  };

  return (
    <View style={styles.wrap} accessibilityLabel="Explore card compose preview">
      <ExploreDecisionCard
        mode="draft"
        category={draft.category ?? 'career'}
        question={pollQuestion}
        options={draft.pollOptions}
        aiSuggestedOptionId={aiLeanId}
        onChangeQuestion={(text) =>
          onChange({
            communityChallengeQuestion: text,
            ...(draft.title.trim().length === 0 ? { title: text } : {}),
          })
        }
        onChangeOptionLabel={updatePollOption}
        onSelectAiLean={(optionId) => onChange({ aiSuggestedOptionId: optionId })}
        onAddOption={addPollOption}
        onRemoveOption={removePollOption}
        onReorderOptions={reorderPollOptions}
      />

      <ExploreCardAiLeanEditor
        verdictLine={draft.communityAiVerdictLine}
        verdictBecause={draft.communityAiBecause}
        confidenceScore={draft.aiConfidenceScore}
        keyMoments={draft.keyMoments}
        expertVerdicts={draft.expertVerdicts}
        onChangeVerdictLine={(text) => onChange({ communityAiVerdictLine: text })}
        onChangeVerdictBecause={(text) => onChange({ communityAiBecause: text })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
});
