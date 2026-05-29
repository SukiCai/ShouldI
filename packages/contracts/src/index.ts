import { z } from 'zod';

export const ProvenanceSchema = z.enum(['community_story', 'ai_framework', 'curated_digest', 'community_ai_validation']);
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const DecisionCategorySchema = z.enum(['life', 'career', 'relationship', 'money']);
export type DecisionCategory = z.infer<typeof DecisionCategorySchema>;

export const TeamDiscussionPostSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  authorEmoji: z.string().default('🙂'),
  /** Which option / "team" this member is speaking for. */
  optionId: z.string(),
  body: z.string(),
  timeLabel: z.string().optional(),
  /** When set, this post is a reply to another post in the same thread. */
  parentId: z.string().optional(),
  /** Synthetic / server count of helpful votes (client may add +1 when the user taps thumbs up). */
  upvoteCount: z.number().int().nonnegative().default(0),
});
export type TeamDiscussionPost = z.infer<typeof TeamDiscussionPostSchema>;

export const ExploreCardSchema = z.object({
  id: z.string(),
  category: DecisionCategorySchema,
  status: z.enum(['open', 'resolved']).default('open'),
  author: z.object({
    id: z.string(),
    name: z.string(),
    avatarEmoji: z.string().default('🙂'),
  }),
  question: z.string(),
  options: z.array(z.object({ id: z.string(), label: z.string() })).min(2),
  distribution: z.array(z.object({ optionId: z.string(), votes: z.number().int().nonnegative() })).min(2),
  discussionPreview: z.array(z.string()).max(4).default([]),
  /** Curated team-thread posts (optionId groups members by choice). */
  discussionPosts: z.array(TeamDiscussionPostSchema).optional().default([]),
  rewardPoints: z.number().int().positive().default(10),
  /** Bookmark this dilemma for quick access later. */
  savedByMe: z.boolean().default(false),
  /** Get notified or see updates when the thread moves. */
  followedByMe: z.boolean().default(false),
  myVoteOptionId: z.string().optional(),
  /** Stable option id the product AI would lean toward if this card were surfaced to ShouldI’s assistant. */
  aiSuggestedOptionId: z.string().optional(),
  /** Optional one-line teaser shown after someone votes so they can compare to the AI leaning. */
  aiSuggestionNote: z.string().optional(),
  winningOptionId: z.string().optional(),
  rewardEligibleOptionId: z.string().optional(),
  notifiedOnOutcome: z.boolean().default(false),
  hook: z.string(),
  tension: z.string(),
  outcome: z.string().optional(),
  takeaway: z.string().optional(),
  provenance: ProvenanceSchema,
  /** Assistant lean rationale (summary line + because); surfaced after vote — vote counts optional for analytics. */
  aiValidation: z
    .object({
      verdictLine: z.string(),
      verdictBecause: z.string(),
      agreeWithAiVotes: z.number().int().nonnegative().default(0),
      disagreeWithAiVotes: z.number().int().nonnegative().default(0),
    })
    .optional(),
  matchHint: z.string().optional(),
});
export type ExploreCard = z.infer<typeof ExploreCardSchema>;

export const ExploreFeedResponseSchema = z.object({
  cards: z.array(ExploreCardSchema),
});
export type ExploreFeedResponse = z.infer<typeof ExploreFeedResponseSchema>;

export const ChatRequestSchema = z.object({
  category: DecisionCategorySchema,
  title: z.string().min(1),
  constraints: z.string().optional(),
  successCriteria: z.string().optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  threadId: z.string(),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      body: z.string(),
    }),
  ),
  disclaimer: z.string(),
  hermesStatus: z.enum(['stub', 'embedded', 'ready', 'error']),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

/** Harmence Decide interview — mobile ↔ ShouldI gateway ↔ Hermes tree signal */
export const DecideInterviewRoleSchema = z.enum(['user', 'assistant']);
export type DecideInterviewRole = z.infer<typeof DecideInterviewRoleSchema>;

export const DecideInterviewBubbleSchema = z.object({
  id: z.string(),
  role: DecideInterviewRoleSchema,
  text: z.string(),
  at: z.number().int(),
  expertId: z.string().optional(),
  expertTitle: z.string().optional(),
  expertIcon: z.string().optional(),
  expertColor: z.string().optional(),
  supportingExpertIds: z.array(z.string()).default([]),
});
export type DecideInterviewBubble = z.infer<typeof DecideInterviewBubbleSchema>;

export const DecideInterviewExpertSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  skillName: z.string(),
  icon: z.string(),
  color: z.string(),
});
export type DecideInterviewExpert = z.infer<typeof DecideInterviewExpertSchema>;

export const DecideInterviewTurnRequestSchema = z.object({
  sessionId: z.string().nullable().optional(),
  userText: z.string().optional().default(''),
  selectedOptionId: z.string().optional(),
});
export type DecideInterviewTurnRequest = z.infer<typeof DecideInterviewTurnRequestSchema>;

export const DecideInterviewChoiceOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});
export type DecideInterviewChoiceOption = z.infer<typeof DecideInterviewChoiceOptionSchema>;

export const DecideInterviewChoicePromptSchema = z.object({
  id: z.string(),
  title: z.string(),
  question: z.string(),
  helperText: z.string().optional(),
  specialistLabel: z.string().optional(),
  speakerExpertId: z.string().optional(),
  supportingExpertIds: z.array(z.string()).default([]),
  whyItMatters: z.string().optional(),
  progress: z
    .object({
      checked: z.number().int().nonnegative(),
      total: z.number().int().positive().optional(),
      label: z.string().optional(),
      mode: z.enum(['bounded', 'adaptive']).default('bounded'),
    })
    .optional(),
  options: z.array(DecideInterviewChoiceOptionSchema).min(2).max(5),
  allowCustomAnswer: z.boolean().default(true),
});
export type DecideInterviewChoicePrompt = z.infer<typeof DecideInterviewChoicePromptSchema>;

export const DecideInterviewDraftHintsSchema = z.object({
  title: z.string().optional(),
  category: DecisionCategorySchema.optional(),
  constraints: z.string().optional(),
  successCriteria: z.string().optional(),
  communityChallengeQuestion: z.string().optional(),
  communityAiVerdictLine: z.string().optional(),
  communityAiBecause: z.string().optional(),
});
export type DecideInterviewDraftHints = z.infer<typeof DecideInterviewDraftHintsSchema>;

export const DecideInterviewFinalDecisionSchema = z.object({
  verdictLine: z.string(),
  recommendation: z.string(),
  rationale: z.string(),
  confidence: z.enum(['low', 'medium', 'high']).default('medium'),
  nextSteps: z.array(z.string()).default([]),
  expertVerdicts: z
    .array(
      z.object({
        expertId: z.string(),
        expertTitle: z.string(),
        verdictLine: z.string(),
        reasoning: z.string(),
        confidence: z.enum(['low', 'medium', 'high']).default('medium'),
        risks: z.array(z.string()).default([]),
        nextQuestionsOrActions: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});
export type DecideInterviewFinalDecision = z.infer<typeof DecideInterviewFinalDecisionSchema>;

export const DecideInterviewPreviewCardSchema = z.object({
  category: DecisionCategorySchema,
  question: z.string(),
  hook: z.string(),
  tension: z.string(),
  options: z.array(DecideInterviewChoiceOptionSchema).min(2).max(4),
  aiVerdictLine: z.string(),
  aiBecause: z.string(),
  discussionPreview: z.array(z.string()).max(4).default([]),
});
export type DecideInterviewPreviewCard = z.infer<typeof DecideInterviewPreviewCardSchema>;

export const DecideInterviewTurnResponseSchema = z.object({
  sessionId: z.string(),
  bubbles: z.array(DecideInterviewBubbleSchema),
  phase: z.string(),
  isComplete: z.boolean(),
  hermesIntegrated: z.boolean(),
  activeExperts: z.array(DecideInterviewExpertSchema).default([]),
  newlyActivatedExperts: z.array(DecideInterviewExpertSchema).default([]),
  suggestedDraftHints: DecideInterviewDraftHintsSchema.optional(),
  choicePrompt: DecideInterviewChoicePromptSchema.optional(),
  finalDecision: DecideInterviewFinalDecisionSchema.optional(),
  previewCard: DecideInterviewPreviewCardSchema.optional(),
});
export type DecideInterviewTurnResponse = z.infer<typeof DecideInterviewTurnResponseSchema>;

export const DecideInterviewSessionSummarySchema = z.object({
  id: z.string(),
  preview: z.string(),
  updatedAt: z.number().int(),
  messageCount: z.number().int().nonnegative(),
});
export type DecideInterviewSessionSummary = z.infer<typeof DecideInterviewSessionSummarySchema>;

export const DecideInterviewSessionsListSchema = z.object({
  sessions: z.array(DecideInterviewSessionSummarySchema),
});

export const DecideInterviewSessionDetailSchema = z.object({
  id: z.string(),
  updatedAt: z.number().int(),
  bubbles: z.array(DecideInterviewBubbleSchema),
  phase: z.string(),
  isComplete: z.boolean(),
  hermesIntegrated: z.boolean(),
  activeExperts: z.array(DecideInterviewExpertSchema).default([]),
  choicePrompt: DecideInterviewChoicePromptSchema.optional(),
  finalDecision: DecideInterviewFinalDecisionSchema.optional(),
});
export type DecideInterviewSessionDetail = z.infer<typeof DecideInterviewSessionDetailSchema>;
