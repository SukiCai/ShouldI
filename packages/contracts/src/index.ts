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
      /** 0-100 AI confidence score to show on the explore card. */
      confidenceScore: z.number().int().min(0).max(100).optional(),
      /** Short peer-readable context labels, e.g. ["Goal: return offer + PR pathway", "Risk: pre-PGWP stage"]. */
      keyContext: z.array(z.string()).default([]),
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
  /** User-facing question shown in the thread (distinct from transition/meta assistantText). */
  question: z.string().optional(),
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
  mode: z.enum(['single', 'complex']).optional(),
  /** Required when starting a new session in council (`complex`) mode. */
  councilUnlock: z.enum(['premium', 'points']).optional(),
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
  speakerExpertId: z.string().nullish(),
  supportingExpertIds: z.array(z.string()).default([]),
  whyItMatters: z.string().optional(),
  progress: z
    .object({
      checked: z.number().int().nonnegative(),
      total: z.number().int().positive().optional(),
      label: z.string().optional(),
      mode: z.enum(['bounded', 'adaptive']).default('bounded'),
      ambiguity: z.number().min(0).max(1).optional(),
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

export const DecideInterviewReflectionSchema = z.object({
  summary: z.string(),
  concerns: z.array(z.string()).max(4).optional(),
});
export type DecideInterviewReflection = z.infer<typeof DecideInterviewReflectionSchema>;

export const DecideInterviewFinalDecisionSchema = z.object({
  verdictLine: z.string(),
  recommendation: z.string(),
  rationale: z.string(),
  confidence: z.enum(['low', 'medium', 'high']).default('medium'),
  /** 0-100 integer confidence score generated by the synthesis model. When present, preferred over ambiguity-based derivation. */
  confidenceScore: z.number().int().min(0).max(100).optional(),
  nextSteps: z.array(z.string()).default([]),
  reflection: DecideInterviewReflectionSchema.optional(),
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
  keyMoments: z
    .array(
      z.object({
        type: z.enum(['clarity', 'expert_join', 'complexity']),
        answer: z.string(),
        question: z.string(),
        impact: z.string(),
        magnitude: z.number(),
        dimension: z.string().optional(),
        expertJoined: z.string().optional(),
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
  mode: z.enum(['single', 'complex']).default('single'),
  ambiguity: z.number().min(0).max(1).optional(),
  activeExperts: z.array(DecideInterviewExpertSchema).default([]),
  newlyActivatedExperts: z.array(DecideInterviewExpertSchema).default([]),
  suggestedDraftHints: DecideInterviewDraftHintsSchema.optional(),
  choicePrompt: DecideInterviewChoicePromptSchema.optional(),
  finalDecision: DecideInterviewFinalDecisionSchema.optional(),
  previewCard: DecideInterviewPreviewCardSchema.optional(),
  /** Durable record id created once a meaningful decision is completed. */
  decisionRecordId: z.string().optional(),
  /** First-session artifact that summarizes the user's decision posture. */
  decisionLens: z
    .object({
      headline: z.string(),
      confidenceScore: z.number().int().min(0).max(100),
      strengths: z.array(z.string()).default([]),
      blindSpots: z.array(z.string()).default([]),
      calibrationFocus: z.string().optional(),
    })
    .optional(),
  /** True when clarity is high — one more answer may unlock the verdict. */
  almostReady: z.boolean().optional(),
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
  mode: z.enum(['single', 'complex']).default('single'),
  ambiguity: z.number().min(0).max(1).optional(),
  activeExperts: z.array(DecideInterviewExpertSchema).default([]),
  choicePrompt: DecideInterviewChoicePromptSchema.optional(),
  finalDecision: DecideInterviewFinalDecisionSchema.optional(),
});
export type DecideInterviewSessionDetail = z.infer<typeof DecideInterviewSessionDetailSchema>;

export const ViewerEntitlementsSchema = z.object({
  isPremium: z.boolean(),
  pointsBalance: z.number().int().nonnegative(),
  councilSessionCost: z.number().int().positive(),
});
export type ViewerEntitlements = z.infer<typeof ViewerEntitlementsSchema>;

export const ViewerMeResponseSchema = z.object({
  anonymous: z.boolean(),
  userId: z.string().nullable(),
  entitlements: ViewerEntitlementsSchema,
});
export type ViewerMeResponse = z.infer<typeof ViewerMeResponseSchema>;

/** Canonical artifact produced by a completed decision flow. */
export const DecisionRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string().nullable().optional(),
  question: z.string(),
  category: DecisionCategorySchema.optional(),
  recommendation: z.string(),
  rationale: z.string(),
  confidenceScore: z.number().int().min(0).max(100),
  tradeoffs: z.array(z.string()).default([]),
  committedAction: z.string().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

export const DecisionLensSchema = z.object({
  decisionRecordId: z.string(),
  headline: z.string(),
  confidenceScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string()).default([]),
  blindSpots: z.array(z.string()).default([]),
  calibrationFocus: z.string().optional(),
  generatedAt: z.number().int(),
});
export type DecisionLens = z.infer<typeof DecisionLensSchema>;

export const OutcomePredictionSchema = z.object({
  id: z.string(),
  decisionRecordId: z.string(),
  predictionText: z.string(),
  predictedProbability: z.number().min(0).max(1).optional(),
  createdAt: z.number().int(),
});
export type OutcomePrediction = z.infer<typeof OutcomePredictionSchema>;

export const OutcomeActualSchema = z.object({
  id: z.string(),
  decisionRecordId: z.string(),
  outcomeText: z.string(),
  happenedAt: z.number().int(),
  createdAt: z.number().int(),
});
export type OutcomeActual = z.infer<typeof OutcomeActualSchema>;

export const OutcomeReplaySchema = z.object({
  decisionRecordId: z.string(),
  prediction: OutcomePredictionSchema.optional(),
  actual: OutcomeActualSchema.optional(),
  reflection: z.string().optional(),
  calibrationDelta: z.number().min(-1).max(1).optional(),
  updatedAt: z.number().int(),
});
export type OutcomeReplay = z.infer<typeof OutcomeReplaySchema>;

export const DecisionDnaProfileSchema = z.object({
  userId: z.string(),
  values: z.array(z.string()).default([]),
  riskPreference: z.enum(['low', 'medium', 'high']).default('medium'),
  blindSpots: z.array(z.string()).default([]),
  calibrationScore: z.number().min(0).max(100).default(50),
  trajectory: z.array(z.string()).default([]),
  updatedAt: z.number().int(),
});
export type DecisionDnaProfile = z.infer<typeof DecisionDnaProfileSchema>;

export const DecisionDnaUpdateEventSchema = z.object({
  id: z.string(),
  userId: z.string(),
  decisionRecordId: z.string(),
  reason: z.enum(['outcome_replay', 'reflection', 'manual_edit']),
  deltaSummary: z.string(),
  createdAt: z.number().int(),
});
export type DecisionDnaUpdateEvent = z.infer<typeof DecisionDnaUpdateEventSchema>;

export const ExploreVoteRequestSchema = z.object({
  optionId: z.string(),
});
export type ExploreVoteRequest = z.infer<typeof ExploreVoteRequestSchema>;

export const ExploreVoteResponseSchema = z.object({
  card: ExploreCardSchema,
});
export type ExploreVoteResponse = z.infer<typeof ExploreVoteResponseSchema>;

export const ExploreFollowRequestSchema = z.object({
  follow: z.boolean().default(true),
});
export type ExploreFollowRequest = z.infer<typeof ExploreFollowRequestSchema>;

export const ExploreSaveRequestSchema = z.object({
  save: z.boolean().default(true),
});
export type ExploreSaveRequest = z.infer<typeof ExploreSaveRequestSchema>;

export const ProductEventSchema = z.object({
  id: z.string(),
  name: z.enum([
    'decision_completed',
    'action_committed',
    'outcome_replayed',
    'confidence_delta',
    'prediction_logged',
    'vote_cast',
  ]),
  decisionRecordId: z.string().optional(),
  cardId: z.string().optional(),
  value: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  at: z.number().int(),
});
export type ProductEvent = z.infer<typeof ProductEventSchema>;

export const ProductEventBatchSchema = z.object({
  events: z.array(ProductEventSchema).min(1),
});
export type ProductEventBatch = z.infer<typeof ProductEventBatchSchema>;
