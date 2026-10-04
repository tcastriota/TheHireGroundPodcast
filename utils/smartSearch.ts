import { VideoEntry } from '../types';

// --- SMART LOCAL SEARCH ---
// Instant, offline search that tolerates typos ("intervew" -> interview) and
// understands related words ("finance" -> banking, wealth, Wall Street...).
// Gemini is only used as a fallback when this finds nothing (see geminiService.ts).

// Words that carry no meaning for matching ("how do I prep for an interview")
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with', 'about', 'from', 'into',
  'how', 'what', 'why', 'when', 'who', 'where', 'which', 'do', 'does', 'did', 'i', 'me', 'my', 'we', 'you',
  'your', 'is', 'are', 'was', 'be', 'been', 'can', 'could', 'should', 'would', 'will', 'get', 'got', 'it',
  'find', 'show', 'video', 'videos', 'episode', 'episodes', 'podcast', 'ground', 'tips', 'advice', 'help',
  'want', 'need', 'like', 'some', 'any', 'that', 'this', 'there', 'their', 'them', 'more', 'most', 'good',
  'best', 'learn', 'know', 'talk', 'talks', 'stuff', 'things', 'thing', 'please', 'am', 'if', 'so', 'just',
]);

// Groups of related words/phrases. A query term matching any entry in a group
// also matches every other entry in that group.
const RELATED_TERMS: string[][] = [
  ['finance', 'financial', 'financial services', 'banking', 'bank', 'banker', 'wealth', 'wealth management',
    'money', 'investing', 'investment', 'investor', 'investment banking', 'wall street', 'trading', 'trader',
    'fintech', 'accounting', 'accountant', 'asset management', 'private equity', 'hedge fund', 'capital',
    'economics', 'budget', 'cpa'],
  ['interview', 'interviewing', 'interviewer', 'interview preparation', 'interview questions',
    'interview mistakes', 'job interview', 'screening'],
  ['hiring', 'hire', 'recruiting', 'recruiter', 'recruitment', 'talent acquisition', 'headhunter',
    'hiring manager', 'candidate', 'hiring decisions', 'executive recruiter'],
  ['job search', 'finding a job', 'job hunt', 'job hunting', 'applying', 'application', 'job offer',
    'unemployed', 'laid off', 'layoff', 'employment', 'job hopper', 'new job'],
  ['resume', 'cv', 'cover letter', 'linkedin', 'portfolio'],
  ['networking', 'network', 'connections', 'relationships', 'rapport', 'rapport building', 'referral',
    'mentor', 'mentorship', 'coffee chat', 'alumni', 'personal connection'],
  ['salary', 'pay', 'compensation', 'negotiation', 'negotiate', 'raise', 'income', 'bonus',
    'sales compensation', 'income impact'],
  ['career change', 'pivot', 'switch careers', 'career switch', 'transition', 'new career', 'reinvent'],
  ['promotion', 'promoted', 'getting promoted', 'advancement', 'career advancement', 'career progression',
    'growth'],
  ['leadership', 'leader', 'manager', 'management', 'managing', 'boss', 'executive', 'people management',
    'leadership development', 'management roles'],
  ['tech', 'technology', 'software', 'software engineer', 'engineering', 'engineer', 'developer', 'coding',
    'programming', 'code', 'cloud', 'cloud computing', 'computer science', 'technology leader', 'cto'],
  ['ai', 'artificial intelligence', 'machine learning', 'ml', 'chatgpt', 'llm', 'automation', 'ai bot'],
  ['data', 'analytics', 'data science', 'data scientist', 'analyst', 'chief data officer', 'data executive',
    'people and data', 'metrics'],
  ['startup', 'startups', 'entrepreneur', 'entrepreneurship', 'founder', 'business owner', 'small business',
    'venture', 'venture capital', 'venture capitalist', 'vc'],
  ['sales', 'salesperson', 'selling', 'revenue', 'chief revenue officer', 'business development',
    'account executive', 'quota', 'sales engineer'],
  ['marketing', 'brand', 'branding', 'advertising', 'marketing executive', 'social media'],
  ['consulting', 'consultant', 'advisory', 'management consultant'],
  ['culture', 'workplace culture', 'corporate culture', 'office', 'office environment', 'work environment',
    'workplace', 'workplace dynamics'],
  ['nonprofit', 'non-profit', 'non-profits', 'philanthropy', 'charity', 'charitable giving', 'giving',
    'social impact', 'effective altruism'],
  ['healthcare', 'health', 'medical', 'hospital', 'healthcare professional'],
  ['hr', 'human resources', 'people operations', 'hr professional'],
  ['student', 'college', 'university', 'new grad', 'graduate', 'entry level', 'internship', 'intern',
    'first job', 'early career'],
  ['introvert', 'introverts', 'shy', 'anxiety', 'nervous', 'confidence', 'imposter syndrome'],
  ['feedback', 'criticism', 'performance review'],
  ['red flags', 'warning signs', 'toxic', 'bad boss'],
  ['hospitality', 'restaurant', 'hotel', 'entertainment', 'gaming', 'entertainment and gaming'],
  ['media', 'journalism', 'film', 'tv', 'television'],
  ['cybersecurity', 'security', 'cyber'],
  ['remote', 'work from home', 'hybrid', 'unlimited vacation', 'vacation'],
  ['education', 'teacher', 'teaching', 'educator', 'history teacher'],
  ['bias', 'fair hiring practices', 'inclusive', 'inclusion', 'diversity', 'ageism'],
];

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Light stemmer so "interviews", "interviewing" and "interviewer" all compare as "interview"
const stem = (w: string) => {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ers')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('er')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
};

// Edit distance, bailing out early once it exceeds `max`
const editDistance = (a: string, b: string, max: number) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
};

const isTypoOf = (term: string, word: string) => {
  if (term.length < 5 || word.length < 4) return false;
  const max = term.length >= 7 ? 2 : 1;
  return editDistance(term, word, max) <= max;
};

interface IndexedField { weight: number; text: string; stems: Set<string>; words: string[] }

const buildField = (value: string | string[] | undefined, weight: number): IndexedField => {
  const text = normalize(Array.isArray(value) ? value.join(' ') : value || '');
  const words = text ? text.split(' ') : [];
  return { weight, text: ` ${text} `, words, stems: new Set(words.map(stem)) };
};

const indexCache = new WeakMap<VideoEntry, IndexedField[]>();
const indexVideo = (v: VideoEntry) => {
  let fields = indexCache.get(v);
  if (!fields) {
    fields = [
      buildField(v.title, 3),
      buildField(v.topics, 3),
      buildField(v.guestProfiles, 2),
      buildField(v.guestName, 2),
      buildField(v.headline, 1.5),
      buildField(v.targetAudience, 1),
      buildField(v.fullDescription || v.description, 1),
    ];
    indexCache.set(v, fields);
  }
  return fields;
};

// All related phrases for a query term (also catches typos of the group words, e.g. "finanse")
const relatedPhrases = (term: string) => {
  const termStem = stem(term);
  const out = new Set<string>();
  for (const group of RELATED_TERMS) {
    const hit = group.some(p => {
      const n = normalize(p);
      return n === term || (!n.includes(' ') && (stem(n) === termStem || isTypoOf(term, n)));
    });
    if (hit) group.forEach(p => out.add(normalize(p)));
  }
  out.delete(term);
  return [...out];
};

const scoreTerm = (term: string, related: string[], fields: IndexedField[]) => {
  const termStem = stem(term);
  let best = 0;
  for (const f of fields) {
    let s = 0;
    if (f.stems.has(termStem)) s = 1;
    else if (term.length >= 3 && f.words.some(w => w.startsWith(term))) s = 0.9;
    else if (related.some(p => (p.includes(' ') ? f.text.includes(` ${p} `) : f.stems.has(stem(p))))) s = 0.7;
    else if (f.words.some(w => isTypoOf(term, w))) s = 0.6;
    best = Math.max(best, s * f.weight);
  }
  return best;
};

/**
 * Returns matching video ids, best match first. For multi-word queries, only videos
 * matching the most query words are kept, so "sales interview" prefers videos about both.
 */
export const smartSearch = (query: string, videos: VideoEntry[]): string[] => {
  const tokens = normalize(query).split(' ').filter(Boolean);
  const meaningful = tokens.filter(t => !STOP_WORDS.has(t));
  const terms = meaningful.length ? meaningful : tokens;
  if (!terms.length) return [];

  const expanded = terms.map(t => ({ term: t, related: relatedPhrases(t) }));

  const scored = videos.map(v => {
    const fields = indexVideo(v);
    let matched = 0;
    let score = 0;
    for (const { term, related } of expanded) {
      const s = scoreTerm(term, related, fields);
      if (s > 0) { matched++; score += s; }
    }
    return { id: v.id, matched, score };
  }).filter(r => r.matched > 0);

  const maxMatched = Math.max(0, ...scored.map(r => r.matched));
  return scored
    .filter(r => r.matched === maxMatched)
    .sort((a, b) => b.score - a.score)
    .map(r => r.id);
};
