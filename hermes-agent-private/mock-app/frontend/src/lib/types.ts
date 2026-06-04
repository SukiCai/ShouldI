export interface MockUser {
  id: string;
  name: string;
  role: string;
  domain: string;
  years_experience: number;
  industry: string;
  bio: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  skillsUsed?: string[];
}

export interface TraitKeyword {
  value: string;
  confidence: number;
}

export interface TraitDimension {
  field: string;
  keywords: TraitKeyword[];
  summary: string;
}

export interface UserProfile {
  user_id: string;
  profile: Record<string, unknown>;
  inferred: TraitDimension[];
  signal_vocab: { term: string; trigger_for: string; confidence: number; updated_at: number }[];
  updated_at: number;
}

export interface GateLogEntry {
  turn: number;
  preview: string;
  gate1: boolean;
  gate2: boolean;
  matched_terms: string[];
}

export interface ClarifyPrompt {
  question: string;
  choices: string[];
}
