// ============================================================================
// CLAUDE API CLIENT — Direct fetch to Anthropic Messages API
// ============================================================================

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 8000;

interface ContentBlock {
  type: string;
  text?: string;
}

interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: ContentBlock[];
  model: string;
  stop_reason: string;
}

/**
 * Call Claude API with web search enabled for MOAT research.
 * Accepts system prompt and user message separately.
 * Extracts all text blocks from the response.
 */
export interface CallClaudeOptions {
  /**
   * Give Claude the web_search tool. Defaults to true, which is what the deep
   * per-investor analyses need. Pass false when the answer should come only
   * from the data in the prompt — it is markedly faster and cheaper.
   */
  webSearch?: boolean;
  maxTokens?: number;
  /**
   * Use this key instead of ANTHROPIC_API_KEY for this call only. Lets the
   * caller run against a key the user supplied at request time.
   */
  apiKey?: string;
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  options: CallClaudeOptions = {}
): Promise<string> {
  const { webSearch = true, maxTokens = MAX_TOKENS, apiKey: overrideKey } = options;

  const apiKey = overrideKey?.trim() || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      ...(webSearch
        ? {
            tools: [
              {
                type: 'web_search_20250305',
                name: 'web_search',
              },
            ],
          }
        : {}),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorBody}`);
  }

  const data: ClaudeResponse = await response.json();

  // Extract all text blocks from the response
  const textBlocks = data.content
    .filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text!)
    .join('\n\n');

  if (!textBlocks) {
    throw new Error('Claude API returned no text content');
  }

  return textBlocks;
}

/**
 * Check if the Claude API key is configured.
 */
export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
