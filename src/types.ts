export type NewsToolId = 
  | 'summarizer' 
  | 'translator' 
  | 'writer' 
  | 'factchecker' 
  | 'analyzer' 
  | 'threads' 
  | 'hooks' 
  | 'captions' 
  | 'newsletter' 
  | 'audio' 
  | 'breakdown' 
  | 'dashboard' 
  | 'calendar' 
  | 'opinion' 
  | 'alerts'
  | 'video';

export interface NewsTool {
  id: NewsToolId;
  name: string;
  description: string;
  icon: string;
  category: 'core' | 'audience' | 'growth' | 'internal';
  status: 'live' | 'under-construction';
}

export interface SummaryResult {
  headline: string;
  oneLine: string;
  highlights: string[];
  eli10: string;
  breakdown: string;
}

export interface TranslationResult {
  translatedText: string;
  contextNote: string;
}

export interface RewriteResult {
  rewrittenText: string;
  styleUsed: string;
}

export interface FactCheckResult {
  claims: Array<{
    claim: string;
    status: 'verified' | 'questionable' | 'likely-false';
    explanation: string;
  }>;
  overallCredibility: string;
}

export interface TrendTopic {
  topic: string;
  engagement: 'high' | 'medium' | 'low';
  keywords: string[];
  suggestions: string[];
}
