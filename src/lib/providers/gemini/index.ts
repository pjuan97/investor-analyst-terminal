import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

export interface GenerateAnalysisResult {
  success: boolean;
  analysis: string | null;
  error?: string;
}

export async function generateModelAnalysis(
  prompt: string
): Promise<GenerateAnalysisResult> {
  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return {
      success: true,
      analysis: text,
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      success: false,
      analysis: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function isGeminiConfigured(): boolean {
  return !!GEMINI_API_KEY;
}
