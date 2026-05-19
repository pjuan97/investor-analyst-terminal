'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { RecommendationDaily } from '@prisma/client';
import type { ModelVotes, ModelVote } from '@/types';

interface LLMAnalysis {
  buffett?: string;
  greenblatt?: string;
  growth?: string;
  lynch?: string;
  generatedAt?: string;
}

interface DeepAnalysis {
  buffett?: string;
  fisher?: string;
  greenblatt?: string;
  lynch?: string;
  summary?: string;
  generatedAt?: string;
}

const DEEP_MODELS = [
  { id: 'buffett', name: 'Warren Buffett', icon: '🏛️' },
  { id: 'fisher', name: 'Philip Fisher', icon: '📈' },
  { id: 'greenblatt', name: 'Joel Greenblatt', icon: '🎯' },
  { id: 'lynch', name: 'Peter Lynch', icon: '⚖️' },
] as const;

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

  // Deep Analysis state
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysis | null>(null);
  const [selectedDeepModels, setSelectedDeepModels] = useState<Set<string>>(new Set());
  const [deepLoading, setDeepLoading] = useState(false);
  const [currentDeepModel, setCurrentDeepModel] = useState<string | null>(null);
  const [deepError, setDeepError] = useState<string | null>(null);
  const [hurdleRate, setHurdleRate] = useState(10);
  const [claudeConfigured, setClaudeConfigured] = useState(false);
  const [expandedDeepModels, setExpandedDeepModels] = useState<Set<string>>(new Set());

  // Fetch existing analysis on mount
  useEffect(() => {
    if (!recommendation) return;

    const fetchAnalysis = async () => {
      setIsLoading(true);
      try {
        const [analysisRes, deepRes] = await Promise.all([
          fetch(`/api/company/${ticker}/analysis`),
          fetch(`/api/company/${ticker}/deep-analysis`),
        ]);

        if (analysisRes.ok) {
          const data = await analysisRes.json();
          setLlmAnalysis(data.analysis);
          setGeminiConfigured(data.geminiConfigured);
        }

        if (deepRes.ok) {
          const data = await deepRes.json();
          setDeepAnalysis(data.deepAnalysis);
          setClaudeConfigured(data.claudeConfigured);
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

  const toggleDeepModel = (id: string) => {
    setSelectedDeepModels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDeepExpanded = (id: string) => {
    setExpandedDeepModels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRunDeepAnalysis = async () => {
    if (selectedDeepModels.size === 0) return;
    setDeepLoading(true);
    setDeepError(null);
    setCurrentDeepModel(null);

    const modelsToRun = Array.from(selectedDeepModels);

    // Show progress for each model
    for (const modelId of modelsToRun) {
      setCurrentDeepModel(modelId);
      // Small delay so the UI updates before the fetch blocks
      await new Promise((r) => setTimeout(r, 50));
    }

    try {
      setCurrentDeepModel(modelsToRun[0]);
      const response = await fetch(`/api/company/${ticker}/deep-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          models: modelsToRun,
          hurdleRate: hurdleRate / 100,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate deep analysis');
      }

      setDeepAnalysis(data.deepAnalysis);

      // Auto-expand all completed models
      const completed = new Set<string>();
      for (const key of Object.keys(data.deepAnalysis || {})) {
        if (key !== 'generatedAt') completed.add(key);
      }
      setExpandedDeepModels(completed);

      if (data.errors?.length > 0) {
        setDeepError(`Partial errors: ${data.errors.join('; ')}`);
      }
    } catch (err) {
      setDeepError(err instanceof Error ? err.message : 'Failed to generate deep analysis');
    } finally {
      setDeepLoading(false);
      setCurrentDeepModel(null);
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

      {/* Deep Analysis Section */}
      <div className="card">
        <div className="mb-4">
          <h3 className="card-header mb-1">Deep Analysis &mdash; Full Investor Framework</h3>
          <p className="text-xs text-terminal-muted">Powered by Claude AI with web research</p>
        </div>

        {/* Model Selection */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {DEEP_MODELS.map((model) => (
              <label
                key={model.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedDeepModels.has(model.id)
                    ? 'border-terminal-accent bg-terminal-accent/10 text-terminal-text'
                    : 'border-terminal-border bg-terminal-bg text-terminal-muted hover:border-terminal-muted'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDeepModels.has(model.id)}
                  onChange={() => toggleDeepModel(model.id)}
                  className="sr-only"
                />
                <span>{model.icon}</span>
                <span className="text-sm font-medium">{model.name}</span>
              </label>
            ))}
          </div>

          {/* Hurdle Rate Input (only when Buffett selected) */}
          {selectedDeepModels.has('buffett') && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-terminal-muted">Hurdle Rate:</label>
              <input
                type="number"
                value={hurdleRate}
                onChange={(e) => setHurdleRate(Number(e.target.value))}
                min={1}
                max={30}
                className="w-20 px-2 py-1 rounded bg-terminal-bg border border-terminal-border text-terminal-text text-sm font-mono text-center"
              />
              <span className="text-sm text-terminal-muted">%</span>
            </div>
          )}

          {/* Run Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleRunDeepAnalysis}
              disabled={deepLoading || selectedDeepModels.size === 0 || !claudeConfigured}
              className={`px-4 py-2 rounded font-medium text-sm transition-colors flex items-center gap-2 ${
                deepLoading || selectedDeepModels.size === 0 || !claudeConfigured
                  ? 'bg-terminal-muted/20 text-terminal-muted cursor-not-allowed'
                  : 'bg-terminal-accent text-terminal-bg hover:bg-terminal-accent/90'
              }`}
            >
              {deepLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="20 8" />
                  </svg>
                  {currentDeepModel
                    ? `Analyzing with ${DEEP_MODELS.find((m) => m.id === currentDeepModel)?.name || currentDeepModel}...`
                    : 'Analyzing...'}
                </>
              ) : (
                'Run Analysis'
              )}
            </button>
            {!claudeConfigured && !isLoading && (
              <span className="text-xs text-yellow-400">Requires ANTHROPIC_API_KEY in settings</span>
            )}
          </div>

          {/* Error */}
          {deepError && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded text-sm text-red-400">
              {deepError}
            </div>
          )}
        </div>

        {/* Deep Analysis Results */}
        {deepAnalysis && (
          <div className="mt-6 pt-4 border-t border-terminal-border space-y-3">
            {deepAnalysis.generatedAt && (
              <p className="text-xs text-terminal-muted">
                Generated {new Date(deepAnalysis.generatedAt).toLocaleDateString()} at{' '}
                {new Date(deepAnalysis.generatedAt).toLocaleTimeString()}
              </p>
            )}

            {/* Individual Model Results */}
            {DEEP_MODELS.map((model) => {
              const content = deepAnalysis[model.id as keyof DeepAnalysis];
              if (!content) return null;

              return (
                <div key={model.id} className="border border-terminal-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleDeepExpanded(model.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-terminal-bg/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>{model.icon}</span>
                      <span className="font-medium text-terminal-text text-sm">{model.name}</span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-terminal-muted transition-transform ${
                        expandedDeepModels.has(model.id) ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedDeepModels.has(model.id) && (
                    <div className="p-4 pt-0 prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ children }) => <h1 className="text-lg font-bold text-terminal-text mt-4 mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-bold text-terminal-text mt-4 mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-bold text-terminal-text mt-3 mb-1">{children}</h3>,
                          p: ({ children }) => <p className="text-sm text-terminal-muted mb-2">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 text-sm text-terminal-muted mb-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 text-sm text-terminal-muted mb-2">{children}</ol>,
                          li: ({ children }) => <li className="text-sm text-terminal-muted">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold text-terminal-text">{children}</strong>,
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-3">
                              <table className="w-full text-xs border-collapse border border-terminal-border">
                                {children}
                              </table>
                            </div>
                          ),
                          th: ({ children }) => (
                            <th className="text-left px-2 py-1 border border-terminal-border bg-terminal-bg text-terminal-text font-semibold whitespace-nowrap">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="px-2 py-1 border border-terminal-border text-terminal-muted text-xs">
                              {children}
                            </td>
                          ),
                        }}
                      >
                        {content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Combined Summary */}
            {deepAnalysis.summary && (
              <div className="border border-terminal-accent/30 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleDeepExpanded('summary')}
                  className="w-full flex items-center justify-between p-3 bg-terminal-accent/5 hover:bg-terminal-accent/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-terminal-accent font-bold text-sm">Combined Summary</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-terminal-accent transition-transform ${
                      expandedDeepModels.has('summary') ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedDeepModels.has('summary') && (
                  <div className="p-4 pt-0 prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h1 className="text-lg font-bold text-terminal-text mt-4 mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold text-terminal-text mt-4 mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold text-terminal-text mt-3 mb-1">{children}</h3>,
                        p: ({ children }) => <p className="text-sm text-terminal-muted mb-2">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 text-sm text-terminal-muted mb-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 text-sm text-terminal-muted mb-2">{children}</ol>,
                        li: ({ children }) => <li className="text-sm text-terminal-muted">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-terminal-text">{children}</strong>,
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-3">
                            <table className="w-full text-xs border-collapse border border-terminal-border">
                              {children}
                            </table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="text-left px-2 py-1 border border-terminal-border bg-terminal-bg text-terminal-text font-semibold whitespace-nowrap">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-2 py-1 border border-terminal-border text-terminal-muted text-xs">
                            {children}
                          </td>
                        ),
                      }}
                    >
                      {deepAnalysis.summary}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
