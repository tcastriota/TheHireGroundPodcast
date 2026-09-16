import React, { useMemo, useState } from 'react';
import { Compass, ArrowRight, ArrowLeft, RotateCcw, Sparkles } from 'lucide-react';
import { VideoEntry } from '../types';
import { logEvent } from '../services/logger';

type TagCategory = 'guestProfiles' | 'topics' | 'targetAudience';

interface TagWeight {
  category: TagCategory;
  value: string;
  weight: number;
}

interface QuizOption {
  id: string;
  label: string;
  weights: TagWeight[];
  formatPreference?: 'short' | 'full';
}

interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
}

// Answer weights reference the real tag values currently used across episodes
// (guestProfiles / topics / targetAudience) so every option maps to actual content.
const QUESTIONS: QuizQuestion[] = [
  {
    id: 'stage',
    question: 'Where are you in your career right now?',
    options: [
      {
        id: 'job-seeker',
        label: 'Looking for my next job / interviewing',
        weights: [
          { category: 'targetAudience', value: 'Job Seekers', weight: 3 },
          { category: 'targetAudience', value: 'Candidates', weight: 2 },
          { category: 'targetAudience', value: 'Interview Candidates', weight: 3 },
          { category: 'targetAudience', value: 'Entry Level Candidates', weight: 1 },
          { category: 'targetAudience', value: 'Recent Graduates', weight: 1 },
          { category: 'targetAudience', value: 'Evaluating Job Offers', weight: 1 },
          { category: 'targetAudience', value: 'Preparing For Interviews', weight: 2 },
        ],
      },
      {
        id: 'ic-to-manager',
        label: 'Individual contributor thinking about management',
        weights: [
          { category: 'targetAudience', value: 'Individual Contributors Considering Management', weight: 3 },
          { category: 'targetAudience', value: 'Aspiring Managers', weight: 3 },
          { category: 'targetAudience', value: 'Aspiring Leaders', weight: 2 },
        ],
      },
      {
        id: 'current-manager',
        label: 'Current manager or director',
        weights: [
          { category: 'targetAudience', value: 'Current Managers', weight: 3 },
          { category: 'targetAudience', value: 'Aspiring Leaders', weight: 1 },
          { category: 'guestProfiles', value: 'Director', weight: 2 },
          { category: 'guestProfiles', value: 'Senior Director', weight: 1 },
          { category: 'guestProfiles', value: 'Managing Director', weight: 1 },
        ],
      },
      {
        id: 'executive',
        label: 'Executive or C-suite',
        weights: [
          { category: 'targetAudience', value: 'Executives', weight: 3 },
          { category: 'guestProfiles', value: 'CEO', weight: 2 },
          { category: 'guestProfiles', value: 'COO', weight: 2 },
          { category: 'guestProfiles', value: 'CTO', weight: 2 },
          { category: 'guestProfiles', value: 'Chief Data Officer', weight: 1 },
          { category: 'guestProfiles', value: 'Chief Revenue Officer', weight: 1 },
          { category: 'guestProfiles', value: 'VP Of Strategy', weight: 2 },
          { category: 'guestProfiles', value: 'Executive', weight: 2 },
        ],
      },
      {
        id: 'founder',
        label: 'Founder / entrepreneur',
        weights: [
          { category: 'guestProfiles', value: 'Entrepreneur', weight: 3 },
          { category: 'guestProfiles', value: 'Venture Capitalist', weight: 1 },
          { category: 'targetAudience', value: 'Entrepreneur', weight: 3 },
        ],
      },
    ],
  },
  {
    id: 'focus',
    question: "What's on your mind right now?",
    options: [
      {
        id: 'interview',
        label: 'Nailing my next interview',
        weights: [
          { category: 'topics', value: 'Interview Advice', weight: 3 },
          { category: 'topics', value: 'Interview Preparation', weight: 3 },
          { category: 'topics', value: 'Interview Questions', weight: 2 },
          { category: 'topics', value: 'Interview Mistakes', weight: 2 },
          { category: 'topics', value: 'Interviewing', weight: 2 },
          { category: 'topics', value: 'First Impressions', weight: 1 },
        ],
      },
      {
        id: 'promotion',
        label: 'Getting promoted / advancing my career',
        weights: [
          { category: 'topics', value: 'Getting Promoted', weight: 3 },
          { category: 'topics', value: 'Career Advancement', weight: 3 },
          { category: 'topics', value: 'Career Progression', weight: 2 },
          { category: 'topics', value: 'Growth', weight: 2 },
        ],
      },
      {
        id: 'leadership',
        label: 'Becoming a better leader / managing people',
        weights: [
          { category: 'topics', value: 'Leadership Development', weight: 3 },
          { category: 'topics', value: 'Management Roles', weight: 2 },
          { category: 'topics', value: 'Feedback', weight: 2 },
          { category: 'topics', value: 'Workplace Dynamics', weight: 1 },
          { category: 'topics', value: 'Stakeholder Management', weight: 1 },
        ],
      },
      {
        id: 'hiring',
        label: 'Hiring and building my team',
        weights: [
          { category: 'topics', value: 'Hiring Decisions', weight: 3 },
          { category: 'topics', value: 'Recruiting', weight: 3 },
          { category: 'topics', value: 'Fair Hiring Practices', weight: 2 },
          { category: 'topics', value: 'Networking', weight: 1 },
        ],
      },
      {
        id: 'career-change',
        label: 'Considering a career change',
        weights: [
          { category: 'topics', value: 'Career Change', weight: 3 },
          { category: 'topics', value: 'Career Fit', weight: 2 },
          { category: 'topics', value: 'Role Alignment', weight: 2 },
          { category: 'topics', value: 'Career Lessons', weight: 1 },
          { category: 'targetAudience', value: 'Career Changers', weight: 2 },
          { category: 'targetAudience', value: 'Considering Career Moves', weight: 2 },
          { category: 'targetAudience', value: 'Professionals Considering Career Changes', weight: 2 },
        ],
      },
    ],
  },
  {
    id: 'domain',
    question: 'Which world are you operating in?',
    options: [
      {
        id: 'tech',
        label: 'Tech, software & AI',
        weights: [
          { category: 'targetAudience', value: 'Tech Professionals', weight: 2 },
          { category: 'targetAudience', value: 'Software Engineers', weight: 2 },
          { category: 'targetAudience', value: 'Technologist', weight: 1 },
          { category: 'topics', value: 'AI', weight: 2 },
          { category: 'topics', value: 'Cloud Computing', weight: 1 },
          { category: 'guestProfiles', value: 'Software Engineer', weight: 2 },
          { category: 'guestProfiles', value: 'Technology Leader', weight: 2 },
        ],
      },
      {
        id: 'data',
        label: 'Data & analytics',
        weights: [
          { category: 'targetAudience', value: 'Data Nerds', weight: 2 },
          { category: 'targetAudience', value: 'Data Professionals', weight: 2 },
          { category: 'targetAudience', value: 'Data Governance People', weight: 1 },
          { category: 'guestProfiles', value: 'Chief Data Officer', weight: 2 },
          { category: 'guestProfiles', value: 'Data Executive', weight: 2 },
          { category: 'topics', value: 'Data Governance', weight: 2 },
          { category: 'topics', value: 'People And Data', weight: 2 },
        ],
      },
      {
        id: 'finance',
        label: 'Finance & fintech',
        weights: [
          { category: 'targetAudience', value: 'Fintech', weight: 2 },
          { category: 'targetAudience', value: 'Fintech People', weight: 2 },
          { category: 'targetAudience', value: 'Financial Services', weight: 1 },
          { category: 'guestProfiles', value: 'Financial Services', weight: 2 },
          { category: 'topics', value: 'Financial Services', weight: 2 },
          { category: 'topics', value: 'Payments', weight: 1 },
        ],
      },
      {
        id: 'healthcare',
        label: 'Healthcare',
        weights: [
          { category: 'targetAudience', value: 'Healthcare Professionals', weight: 3 },
          { category: 'guestProfiles', value: 'Healthcare Professional', weight: 3 },
          { category: 'topics', value: 'Healthcare', weight: 3 },
        ],
      },
      {
        id: 'sales',
        label: 'Sales & marketing',
        weights: [
          { category: 'guestProfiles', value: 'Salesperson', weight: 2 },
          { category: 'guestProfiles', value: 'Sales Engineer', weight: 2 },
          { category: 'guestProfiles', value: 'Marketing Executive', weight: 2 },
          { category: 'targetAudience', value: 'Sales Professionals', weight: 2 },
          { category: 'targetAudience', value: 'Salespeople', weight: 2 },
        ],
      },
      {
        id: 'general',
        label: "None of these / general career growth",
        weights: [],
      },
    ],
  },
  {
    id: 'time',
    question: 'How much time do you have right now?',
    options: [
      {
        id: 'short',
        label: 'A couple minutes — give me quick hits',
        weights: [],
        formatPreference: 'short',
      },
      {
        id: 'full',
        label: "I've got time for a full conversation",
        weights: [],
        formatPreference: 'full',
      },
    ],
  },
];

const TOP_MATCH_COUNT = 8;

function scoreVideo(video: VideoEntry, selectedOptions: QuizOption[]): number {
  let score = 0;
  for (const option of selectedOptions) {
    for (const tag of option.weights) {
      const values = video[tag.category] as string[] | undefined;
      if (values?.includes(tag.value)) score += tag.weight;
    }
    if (option.formatPreference === 'short' && video.isShort === 'Y') score += 1;
    if (option.formatPreference === 'full' && video.isShort !== 'Y') score += 1;
  }
  return score;
}

interface CareerPathQuizProps {
  videos: VideoEntry[];
  onViewResults: (videoIds: string[]) => void;
}

export const CareerPathQuiz: React.FC<CareerPathQuizProps> = ({ videos, onViewResults }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuizOption>>({});

  const currentQuestion = QUESTIONS[stepIndex];
  const isComplete = stepIndex >= QUESTIONS.length;

  const topMatches = useMemo(() => {
    if (!isComplete) return [];
    const selectedOptions = Object.values(answers);
    const scored = videos
      .map(v => ({ video: v, score: scoreVideo(v, selectedOptions) }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);

    const fallback = scored.length > 0
      ? scored
      : videos
          .slice()
          .sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())
          .map(v => ({ video: v, score: 0 }));

    return fallback.slice(0, TOP_MATCH_COUNT);
  }, [isComplete, answers, videos]);

  const handleSelect = (option: QuizOption) => {
    const nextAnswers = { ...answers, [currentQuestion.id]: option };
    setAnswers(nextAnswers);

    if (stepIndex === QUESTIONS.length - 1) {
      const selectedOptions = Object.values(nextAnswers);
      const scored = videos
        .map(v => ({ video: v, score: scoreVideo(v, selectedOptions) }))
        .filter(s => s.score > 0);
      logEvent(
        'QUIZ_COMPLETED',
        `Answers: ${Object.values(nextAnswers).map(o => o.label).join(' | ')} | Matches: ${scored.length}`
      );
    }
    setStepIndex(stepIndex + 1);
  };

  const handleBack = () => {
    if (stepIndex === 0) return;
    setStepIndex(stepIndex - 1);
  };

  const handleRestart = () => {
    setStepIndex(0);
    setAnswers({});
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24 animate-fadeIn">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
          <Compass size={14} /> Career Path Predictor
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Which episodes fit where you're headed?</h2>
        <p className="text-gray-500 text-sm mt-1">Answer a few quick questions and we'll point you to the right episodes.</p>
      </div>

      {!isComplete ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            {QUESTIONS.map((q, i) => (
              <div
                key={q.id}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-blue-500' : 'bg-gray-100'}`}
              />
            ))}
          </div>

          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Question {stepIndex + 1} of {QUESTIONS.length}
          </p>
          <h3 className="text-lg font-bold text-gray-900 mb-5">{currentQuestion.question}</h3>

          <div className="space-y-2">
            {currentQuestion.options.map(option => (
              <button
                key={option.id}
                onClick={() => handleSelect(option)}
                className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors font-medium text-gray-700 flex items-center justify-between group"
              >
                {option.label}
                <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors shrink-0 ml-3" />
              </button>
            ))}
          </div>

          {stepIndex > 0 && (
            <button
              onClick={handleBack}
              className="mt-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 text-center">
          <Sparkles className="mx-auto text-blue-600 mb-3" size={28} />
          <h3 className="text-xl font-bold text-gray-900 mb-1">
            Found {topMatches.length} episode{topMatches.length === 1 ? '' : 's'} for you
          </h3>
          <p className="text-gray-500 text-sm mb-6">Based on your answers, here's where to start.</p>

          <ul className="text-left space-y-2 mb-6">
            {topMatches.slice(0, 5).map(({ video }) => (
              <li key={video.id} className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                <p className="font-bold text-gray-900 text-sm">{video.title}</p>
                {video.guestName && <p className="text-xs text-gray-500 mt-0.5">{video.guestName}</p>}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => onViewResults(topMatches.map(m => m.video.id))}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all active:scale-95"
            >
              View All Matches In Directory
            </button>
            <button
              onClick={handleRestart}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors px-3 py-2.5"
            >
              <RotateCcw size={14} /> Retake Quiz
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
