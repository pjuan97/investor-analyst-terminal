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
export async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
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
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
        },
      ],
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
