import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GeminiResponse, AggregatedContext } from '../types';
import { buildSystemPrompt } from './contextManager';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

/**
 * Initialize the Gemini SDK with API key
 */
export const initializeGemini = (apiKey: string): void => {
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
};

/**
 * Check if Gemini is initialized
 */
export const isGeminiInitialized = (): boolean => {
  return model !== null;
};

/**
 * Send a prompt to Gemini with file content and aggregated context
 */
export const promptWithContext = async (
  userPrompt: string,
  fileContent: string,
  context: AggregatedContext
): Promise<GeminiResponse> => {
  if (!model) {
    throw new Error('Gemini not initialized. Please set your API key in Settings.');
  }

  const systemPrompt = buildSystemPrompt(context, fileContent);
  
  const fullPrompt = `${systemPrompt}\n\n## User Request\n${userPrompt}\n\nPlease provide the updated file content. Start your response with the file content wrapped in triple backticks, then optionally provide an explanation.`;

  try {
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    // Parse response to extract content and explanation
    const { content, explanation } = parseGeminiResponse(text);

    return {
      newContent: content || fileContent, // Fall back to original if parsing fails
      explanation,
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
};

/**
 * Parse Gemini's response to extract file content and explanation
 */
const parseGeminiResponse = (response: string): { content: string | null; explanation?: string } => {
  // Try to extract content from code blocks
  const codeBlockMatch = response.match(/```(?:\w*\n)?([\s\S]*?)```/);
  
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    // Get explanation (everything after the code block)
    const afterCodeBlock = response.slice(response.indexOf('```', response.indexOf('```') + 3) + 3).trim();
    
    return {
      content,
      explanation: afterCodeBlock || undefined,
    };
  }
  
  // If no code block, treat the whole response as content
  return {
    content: response.trim(),
    explanation: undefined,
  };
};

/**
 * Simple prompt for non-file operations
 */
export const simplePrompt = async (prompt: string): Promise<string> => {
  if (!model) {
    throw new Error('Gemini not initialized. Please set your API key in Settings.');
  }

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
};
