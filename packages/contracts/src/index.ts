import { z } from 'zod';

export const ProvenanceSchema = z.enum(['community_story', 'ai_framework', 'curated_digest']);
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
