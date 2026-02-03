'use client';

import type { RecommendationDaily } from '@prisma/client';
import type { ModelVotes, ModelVote } from '@/types';

interface ModelsTabProps {
  recommendation: RecommendationDaily | null;
}

export function ModelsTab({ recommendation }: ModelsTabProps) {
  if (!recommendation) {
    return (
      <div className="card text-center py-12">
        <p className="text-terminal-muted">No model analysis available yet.</p>
        <p className="text-sm text-terminal-muted mt-2">
          Click the &quot;Refresh&quot; button above to fetch data and run the analysis models.
        </p>
      </div>
    );
  }

  const modelVotes = recommendation.modelVotes as ModelVotes;

  const models = [
    {
      id: 'buffett',
      name: 'Buffett Model',
      description: 'Quality + reasonable valuation. Looks for durable competitive advantages, high ROE/ROIC, conservative debt, and margin of safety.',
      vote: modelVotes.buffett,
    },
    {
      id: 'greenblatt',
      name: 'Greenblatt Magic Formula',
      description: 'Ranks by Earnings Yield (EBIT/EV) and Return on Capital (EBIT/Capital). Seeks cheap, high-quality businesses.',
      vote: modelVotes.greenblatt,
    },
    {
      id: 'growth',
      name: 'Fisher Growth Model',
      description: 'Focuses on sustained revenue/EPS growth above industry, rising margins, R&D effectiveness, and conservative financing.',
      vote: modelVotes.growth,
    },
    {
      id: 'lynch',
      name: 'Lynch GARP Model',
      description: 'Growth At Reasonable Price. Uses PEG ratio (P/E ÷ Growth), stock categorization, and story-numbers alignment.',
      vote: modelVotes.lynch,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="card">
        <h3 className="card-header">Model Consensus</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {models.map((model) => (
            <ModelSummaryCard
              key={model.id}
              name={model.name}
              vote={model.vote}
            />
          ))}
        </div>
      </div>

      {/* Detailed Breakdown */}
      {models.map((model) => (
        <ModelDetailCard
          key={model.id}
          name={model.name}
          description={model.description}
          vote={model.vote}
        />
      ))}

      {/* Aggregation Explanation */}
      <div className="card">
        <h3 className="card-header">How Recommendations Are Calculated</h3>
        <div className="text-sm text-terminal-muted space-y-2">
          <p>
            The final recommendation is determined by aggregating votes from all models:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Each model votes BUY, HOLD, or SELL with a confidence score (0-100%)</li>
            <li>Votes are weighted by confidence</li>
            <li>The majority vote determines the final recommendation</li>
            <li>Final confidence is the weighted average of agreeing models</li>
          </ul>
          <p className="mt-4">
            <strong>Current weights:</strong> All models are equally weighted in MVP.
            Future versions may adjust weights based on backtesting performance.
          </p>
        </div>
      </div>
    </div>
  );
}

function ModelSummaryCard({ name, vote }: { name: string; vote?: ModelVote }) {
  if (!vote) {
    return (
      <div className="p-4 bg-terminal-bg rounded-lg border border-terminal-border">
        <div className="text-sm font-medium text-terminal-text">{name}</div>
        <div className="text-2xl font-bold text-terminal-muted mt-2">—</div>
        <div className="text-xs text-terminal-muted mt-1">No data</div>
      </div>
    );
  }

  const ratingColors = {
    BUY: 'text-green-400',
    HOLD: 'text-yellow-400',
    SELL: 'text-red-400',
  };

  return (
    <div className="p-4 bg-terminal-bg rounded-lg border border-terminal-border">
      <div className="text-sm font-medium text-terminal-text">{name}</div>
      <div className={`text-2xl font-bold ${ratingColors[vote.rating]} mt-2`}>
        {vote.rating}
      </div>
      <div className="text-xs text-terminal-muted mt-1">
        {(vote.confidence * 100).toFixed(0)}% confidence
      </div>
    </div>
  );
}

function ModelDetailCard({
  name,
  description,
  vote,
}: {
  name: string;
  description: string;
  vote?: ModelVote;
}) {
  if (!vote) {
    return (
      <div className="card opacity-50">
        <h3 className="card-header">{name}</h3>
        <p className="text-sm text-terminal-muted">{description}</p>
        <div className="mt-4 p-4 bg-terminal-bg rounded-lg text-center text-terminal-muted">
          Model not yet calculated
        </div>
      </div>
    );
  }

  const ratingColors = {
    BUY: 'badge-buy',
    HOLD: 'badge-hold',
    SELL: 'badge-sell',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="card-header mb-0">{name}</h3>
          <p className="text-sm text-terminal-muted mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${ratingColors[vote.rating]} text-lg px-3 py-1`}>
            {vote.rating}
          </span>
          <div className="text-right">
            <div className="text-lg font-bold text-terminal-text">
              {(vote.confidence * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-terminal-muted">confidence</div>
          </div>
        </div>
      </div>

      {/* Reasons */}
      <div className="mt-4">
        <div className="text-sm font-medium text-terminal-text mb-2">Analysis</div>
        <ul className="space-y-2">
          {vote.reasons.map((reason, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-terminal-muted"
            >
              <span className="text-terminal-accent mt-0.5">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Key Metrics Used */}
      {vote.keyMetrics && Object.keys(vote.keyMetrics).length > 0 && (
        <div className="mt-4 pt-4 border-t border-terminal-border">
          <div className="text-sm font-medium text-terminal-text mb-2">
            Key Metrics
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(vote.keyMetrics).map(([key, value]) => (
              <div key={key}>
                <div className="text-xs text-terminal-muted capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div className="text-sm font-mono text-terminal-text">
                  {formatMetricValue(key, value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatMetricValue(key: string, value: number | null): string {
  if (value === null) return '—';

  // Percentages
  if (
    key.toLowerCase().includes('margin') ||
    key.toLowerCase().includes('yield') ||
    key.toLowerCase().includes('roe') ||
    key.toLowerCase().includes('roic') ||
    key.toLowerCase().includes('growth')
  ) {
    return `${(value * 100).toFixed(1)}%`;
  }

  // Ratios
  if (key.toLowerCase().includes('ratio') || key.toLowerCase().includes('pe') || key.toLowerCase().includes('pb')) {
    return `${value.toFixed(2)}x`;
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
