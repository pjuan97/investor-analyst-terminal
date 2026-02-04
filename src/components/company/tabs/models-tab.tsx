'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { RecommendationDaily } from '@prisma/client';
import type { ModelVotes, ModelVote } from '@/types';

interface LLMAnalysis {
  buffett?: string;
  greenblatt?: string;
  growth?: string;
  lynch?: string;
  generatedAt?: string;
}

interface ModelsTabProps {
  recommendation: RecommendationDaily | null;
  ticker: string;
}

export function ModelsTab({ recommendation, ticker }: ModelsTabProps) {
  const [llmAnalysis, setLlmAnalysis] = useState<LLMAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [showAISection, setShowAISection] = useState(false);

  // Fetch existing analysis on mount
  useEffect(() => {
    if (!recommendation) return;

    const fetchAnalysis = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/company/${ticker}/analysis`);
        if (response.ok) {
          const data = await response.json();
          setLlmAnalysis(data.analysis);
          setGeminiConfigured(data.geminiConfigured);
        }
      } catch (err) {
        console.error('Failed to fetch analysis:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysis();
  }, [recommendation, ticker]);

  const handleGenerateAnalysis = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/company/${ticker}/analysis`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate analysis');
      }

      // Check if any models got analysis
      const hasAnyAnalysis = data.analysis && (
        data.analysis.buffett ||
        data.analysis.greenblatt ||
        data.analysis.growth ||
        data.analysis.lynch
      );

      if (!hasAnyAnalysis && data.errors?.length > 0) {
        throw new Error(`Analysis generation failed: ${data.errors[0]}`);
      }

      setLlmAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate analysis');
    } finally {
      setIsGenerating(false);
    }
  };

  // Check if we have any actual AI analysis content
  const hasAIContent = llmAnalysis && (
    llmAnalysis.buffett ||
    llmAnalysis.greenblatt ||
    llmAnalysis.growth ||
    llmAnalysis.lynch
  );

  if (!recommendation) {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl mb-4">📊</div>
        <p className="text-terminal-text font-medium">No model analysis available yet</p>
        <p className="text-sm text-terminal-muted mt-2">
          Click the &quot;Refresh&quot; button above to fetch data and run the investment models.
        </p>
      </div>
    );
  }

  const modelVotes = recommendation.modelVotes as ModelVotes;

  const models = [
    {
      id: 'buffett',
      name: 'Warren Buffett',
      subtitle: 'Quality Value Investing',
      icon: '🏛️',
      description: 'Seeks durable competitive advantages, high returns on capital, conservative debt, and margin of safety.',
      vote: modelVotes.buffett,
    },
    {
      id: 'greenblatt',
      name: 'Joel Greenblatt',
      subtitle: 'Magic Formula',
      icon: '🎯',
      description: 'Ranks by Earnings Yield (EBIT/EV) and Return on Capital. Seeks cheap, high-quality businesses.',
      vote: modelVotes.greenblatt,
    },
    {
      id: 'growth',
      name: 'Philip Fisher',
      subtitle: 'Growth Investing',
      icon: '📈',
      description: 'Focuses on sustained growth, rising margins, R&D effectiveness, and long-term potential.',
      vote: modelVotes.growth,
    },
    {
      id: 'lynch',
      name: 'Peter Lynch',
      subtitle: 'GARP Strategy',
      icon: '⚖️',
      description: 'Growth At Reasonable Price. Uses PEG ratio and stock categorization.',
      vote: modelVotes.lynch,
    },
  ];

  // Calculate vote summary
  const voteCounts = { BUY: 0, HOLD: 0, SELL: 0 };
  models.forEach(m => {
    if (m.vote) voteCounts[m.vote.rating]++;
  });

  return (
    <div className="space-y-6">
      {/* Consensus Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header mb-0">Model Consensus</h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-terminal-muted">{voteCounts.BUY} Buy</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              <span className="text-terminal-muted">{voteCounts.HOLD} Hold</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-terminal-muted">{voteCounts.SELL} Sell</span>
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {models.map((model) => (
            <ModelSummaryCard
              key={model.id}
              icon={model.icon}
              name={model.name}
              vote={model.vote}
            />
          ))}
        </div>
      </div>

      {/* Individual Model Analysis */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-terminal-text">Detailed Model Analysis</h3>
        {models.map((model) => (
          <ModelDetailCard
            key={model.id}
            modelId={model.id}
            icon={model.icon}
            name={model.name}
            subtitle={model.subtitle}
            description={model.description}
            vote={model.vote}
            llmAnalysis={llmAnalysis?.[model.id as keyof LLMAnalysis] as string | undefined}
          />
        ))}
      </div>

      {/* AI Analysis Section (Collapsed by default) */}
      <div className="card">
        <button
          onClick={() => setShowAISection(!showAISection)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🤖</span>
            <div className="text-left">
              <h3 className="font-semibold text-terminal-text">AI-Enhanced Analysis</h3>
              <p className="text-xs text-terminal-muted">
                {hasAIContent
                  ? `Generated ${new Date(llmAnalysis!.generatedAt!).toLocaleDateString()}`
                  : 'Optional: Generate deeper insights using Gemini AI'}
              </p>
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-terminal-muted transition-transform ${showAISection ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAISection && (
          <div className="mt-4 pt-4 border-t border-terminal-border">
            {hasAIContent ? (
              <div className="space-y-4">
                <p className="text-sm text-green-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  AI analysis available - expand each model card above to view
                </p>
                <button
                  onClick={handleGenerateAnalysis}
                  disabled={isGenerating || !geminiConfigured}
                  className="text-sm text-terminal-accent hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {isGenerating ? 'Regenerating...' : 'Regenerate Analysis'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-terminal-muted">
                  The AI analysis adds narrative explanations to each model&apos;s findings,
                  providing deeper context beyond the key metrics and bullet points shown above.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerateAnalysis}
                    disabled={isGenerating || !geminiConfigured}
                    className={`px-4 py-2 rounded font-medium text-sm transition-colors flex items-center gap-2 ${
                      isGenerating || !geminiConfigured
                        ? 'bg-terminal-muted/20 text-terminal-muted cursor-not-allowed'
                        : 'bg-terminal-accent text-terminal-bg hover:bg-terminal-accent/90'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="20 8" />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      'Generate AI Analysis'
                    )}
                  </button>
                  {!geminiConfigured && !isLoading && (
                    <span className="text-xs text-yellow-400">Requires Gemini API key in settings</span>
                  )}
                </div>
              </div>
            )}
            {error && (
              <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="card">
        <h3 className="card-header">How Recommendations Work</h3>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-terminal-text mb-2">Voting System</h4>
            <ul className="space-y-1.5 text-terminal-muted">
              <li className="flex items-start gap-2">
                <span className="text-terminal-accent">•</span>
                Each model independently analyzes the company
              </li>
              <li className="flex items-start gap-2">
                <span className="text-terminal-accent">•</span>
                Models vote BUY, HOLD, or SELL with confidence
              </li>
              <li className="flex items-start gap-2">
                <span className="text-terminal-accent">•</span>
                Final rating uses confidence-weighted majority
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-terminal-text mb-2">Confidence Scores</h4>
            <ul className="space-y-1.5 text-terminal-muted">
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                <span><strong className="text-green-400">80%+</strong> Strong conviction</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                <span><strong className="text-yellow-400">60-80%</strong> Moderate conviction</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                <span><strong className="text-red-400">&lt;60%</strong> Low conviction / mixed signals</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModelSummaryCard({ icon, name, vote }: { icon: string; name: string; vote?: ModelVote }) {
  if (!vote) {
    return (
      <div className="p-3 bg-terminal-bg rounded-lg border border-terminal-border text-center">
        <div className="text-lg mb-1">{icon}</div>
        <div className="text-xs font-medium text-terminal-text truncate">{name}</div>
        <div className="text-lg font-bold text-terminal-muted mt-1">—</div>
      </div>
    );
  }

  const ratingStyles = {
    BUY: 'text-green-400 bg-green-400/10 border-green-400/30',
    HOLD: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    SELL: 'text-red-400 bg-red-400/10 border-red-400/30',
  };

  return (
    <div className={`p-3 rounded-lg border text-center ${ratingStyles[vote.rating]}`}>
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-xs font-medium truncate">{name}</div>
      <div className="text-lg font-bold mt-1">{vote.rating}</div>
      <div className="text-xs opacity-75">{(vote.confidence * 100).toFixed(0)}%</div>
    </div>
  );
}

function ModelDetailCard({
  modelId,
  icon,
  name,
  subtitle,
  description,
  vote,
  llmAnalysis,
}: {
  modelId: string;
  icon: string;
  name: string;
  subtitle: string;
  description: string;
  vote?: ModelVote;
  llmAnalysis?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAIDetail, setShowAIDetail] = useState(false);

  if (!vote) {
    return (
      <div className="card opacity-60">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h4 className="font-semibold text-terminal-text">{name}</h4>
            <p className="text-xs text-terminal-muted">{subtitle}</p>
          </div>
        </div>
        <div className="mt-3 p-3 bg-terminal-bg rounded text-center text-terminal-muted text-sm">
          Insufficient data for analysis
        </div>
      </div>
    );
  }

  const ratingColors = {
    BUY: { badge: 'bg-green-500/20 text-green-400 border-green-500/30', bar: 'bg-green-500' },
    HOLD: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', bar: 'bg-yellow-500' },
    SELL: { badge: 'bg-red-500/20 text-red-400 border-red-500/30', bar: 'bg-red-500' },
  };

  const confidenceColor = vote.confidence >= 0.8 ? 'text-green-400' : vote.confidence >= 0.6 ? 'text-yellow-400' : 'text-red-400';

  // Categorize reasons as bullish or bearish based on keywords
  const categorizeReason = (reason: string): 'bullish' | 'bearish' | 'neutral' => {
    const bullishKeywords = ['exceeds', 'strong', 'excellent', 'good', 'high', 'above', 'positive', 'growth', 'healthy', 'impressive', 'conservative debt', 'fast grower'];
    const bearishKeywords = ['below', 'weak', 'poor', 'low', 'negative', 'concern', 'risk', 'expensive', 'overvalued', 'decline', 'failing', 'insufficient'];

    const lowerReason = reason.toLowerCase();
    if (bullishKeywords.some(kw => lowerReason.includes(kw))) return 'bullish';
    if (bearishKeywords.some(kw => lowerReason.includes(kw))) return 'bearish';
    return 'neutral';
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h4 className="font-semibold text-terminal-text">{name}</h4>
            <p className="text-xs text-terminal-muted">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className={`inline-block px-3 py-1 rounded border text-sm font-bold ${ratingColors[vote.rating].badge}`}>
              {vote.rating}
            </span>
          </div>
          <div className="text-right">
            <div className={`text-xl font-bold ${confidenceColor}`}>
              {(vote.confidence * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-terminal-muted">confidence</div>
          </div>
        </div>
      </div>

      {/* Confidence Bar */}
      <div className="mt-3 h-1.5 bg-terminal-border rounded-full overflow-hidden">
        <div
          className={`h-full ${ratingColors[vote.rating].bar} transition-all`}
          style={{ width: `${vote.confidence * 100}%` }}
        />
      </div>

      {/* Collapsible Content */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-4 flex items-center gap-2 text-sm text-terminal-muted hover:text-terminal-text transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {isExpanded ? 'Hide Details' : 'Show Details'}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Model Description */}
          <p className="text-sm text-terminal-muted">{description}</p>

          {/* Analysis Reasons */}
          <div>
            <h5 className="text-sm font-medium text-terminal-text mb-2">Key Findings</h5>
            <div className="space-y-2">
              {vote.reasons.map((reason, i) => {
                const category = categorizeReason(reason);
                const iconColor = category === 'bullish' ? 'text-green-400' : category === 'bearish' ? 'text-red-400' : 'text-terminal-muted';
                const bulletIcon = category === 'bullish' ? '↑' : category === 'bearish' ? '↓' : '•';

                return (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className={`${iconColor} font-mono w-4 flex-shrink-0`}>{bulletIcon}</span>
                    <span className="text-terminal-muted">{reason}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key Metrics */}
          {vote.keyMetrics && Object.keys(vote.keyMetrics).length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-terminal-text mb-2">Metrics Used</h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(vote.keyMetrics).map(([key, value]) => (
                  <div key={key} className="bg-terminal-bg rounded p-2">
                    <div className="text-xs text-terminal-muted capitalize">
                      {formatMetricLabel(key)}
                    </div>
                    <div className="text-sm font-mono text-terminal-text font-medium">
                      {formatMetricValue(key, value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis (if available) */}
          {llmAnalysis && (
            <div className="pt-3 border-t border-terminal-border">
              <button
                onClick={() => setShowAIDetail(!showAIDetail)}
                className="flex items-center gap-2 text-sm text-terminal-accent hover:text-terminal-accent/80 transition-colors"
              >
                <span>🤖</span>
                <span>{showAIDetail ? 'Hide' : 'Show'} AI-Generated Analysis</span>
                <svg
                  className={`w-4 h-4 transition-transform ${showAIDetail ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showAIDetail && (
                <div className="mt-3 p-4 bg-terminal-bg rounded-lg prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="text-lg font-bold text-terminal-text mt-4 mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-bold text-terminal-text mt-4 mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-bold text-terminal-text mt-3 mb-1">{children}</h3>,
                      p: ({ children }) => <p className="text-sm text-terminal-muted mb-2">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside space-y-1 text-sm text-terminal-muted mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 text-sm text-terminal-muted mb-2">{children}</ol>,
                      li: ({ children }) => <li className="text-sm text-terminal-muted">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-terminal-text">{children}</strong>,
                      table: ({ children }) => <table className="w-full text-sm my-2 border-collapse">{children}</table>,
                      th: ({ children }) => <th className="text-left p-2 border-b border-terminal-border text-terminal-text">{children}</th>,
                      td: ({ children }) => <td className="p-2 border-b border-terminal-border text-terminal-muted">{children}</td>,
                    }}
                  >
                    {llmAnalysis}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatMetricLabel(key: string): string {
  const labels: Record<string, string> = {
    roe: 'ROE',
    roic: 'ROIC',
    roa: 'ROA',
    peRatio: 'P/E Ratio',
    pbRatio: 'P/B Ratio',
    peg: 'PEG Ratio',
    pegy: 'PEGY Ratio',
    evToEbitda: 'EV/EBITDA',
    debtToEquity: 'Debt/Equity',
    currentRatio: 'Current Ratio',
    grossMargin: 'Gross Margin',
    operatingMargin: 'Op. Margin',
    netMargin: 'Net Margin',
    fcfMargin: 'FCF Margin',
    fcfYield: 'FCF Yield',
    earningsYield: 'Earnings Yield',
    epsGrowth: 'EPS Growth',
    revenueGrowth: 'Revenue Growth',
    totalScore: 'Total Score',
  };
  return labels[key] || key.replace(/([A-Z])/g, ' $1').trim();
}

function formatMetricValue(key: string, value: number | null): string {
  if (value === null || value === undefined) return '—';

  // Percentages
  if (
    key.toLowerCase().includes('margin') ||
    key.toLowerCase().includes('yield') ||
    key === 'roe' ||
    key === 'roic' ||
    key === 'roa' ||
    key.toLowerCase().includes('growth')
  ) {
    return `${(value * 100).toFixed(1)}%`;
  }

  // Ratios
  if (key.toLowerCase().includes('ratio') || key === 'peg' || key === 'pegy' || key.toLowerCase().includes('pe') || key.toLowerCase().includes('pb')) {
    return `${value.toFixed(2)}x`;
  }

  // Score
  if (key === 'totalScore') {
    return `${value.toFixed(0)}/100`;
  }

  // Large numbers
  if (Math.abs(value) >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  }
  if (Math.abs(value) >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  }

  return value.toFixed(2);
}
