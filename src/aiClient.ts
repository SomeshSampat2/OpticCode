import { fetch as undiciFetch } from 'undici';
(globalThis as any).fetch = undiciFetch;
import * as vscode from 'vscode';
import { GoogleGenAI, Type } from '@google/genai';

// Gemini integration via VS Code configuration

/**
 * Generates AI-based edit instructions given workspace context and a user prompt.
 */
export async function generateEdit(context: string[], userPrompt: string, inlineImage?: { mimeType: string; data: string }): Promise<string> {
  // fetch API key from settings
  const config = vscode.workspace.getConfiguration('opticCode');
  const apiKey = config.get<string>('geminiApiKey');
  if (!apiKey) {
    vscode.window.showErrorMessage('Please set opticCode.geminiApiKey in settings');
    return '';
  }
  const ai = new GoogleGenAI({ apiKey });
  // personality for AI assistant
  const systemInstructions = `You are Optic Code, a friendly and knowledgeable AI assistant specialized in coding. Balance conciseness with clarity in your responses:

1. For code explanation queries: Provide sufficient explanation to ensure understanding - include purpose, logic flow, and key concepts, but avoid excessive detail unless requested.

2. For implementation tasks: Focus on delivering high-quality, well-structured code with essential comments. Include brief explanations of complex logic or architectural decisions.

3. For UI implementations: Always provide modern, beautiful UI designs with clean layouts, appropriate spacing, accessibility features, and subtle animations where relevant. Follow current design trends and best practices.

4. Keep answers focused on the specific question without unnecessary background information.`;
  const promptText = `${systemInstructions}\n\nWorkspace context:\n${context.join('\n')}\n--\nUser request: ${userPrompt}`;
  const contents = inlineImage
    ? [ { inlineData: { mimeType: inlineImage.mimeType, data: inlineImage.data } }, promptText ]
    : promptText;
  try {
    const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents });
    return response.text;
  } catch (err) {
    vscode.window.showErrorMessage('AI request failed: ' + (err as Error).message);
    return '';
  }
}

/**
 * Streams AI-based responses for a user prompt using Gemini streaming.
 */
export async function* generateEditStream(context: string[], userPrompt: string, inlineImage?: { mimeType: string; data: string }): AsyncGenerator<string> {
  const config = vscode.workspace.getConfiguration('opticCode');
  const apiKey = config.get<string>('geminiApiKey');
  if (!apiKey) {
    vscode.window.showErrorMessage('Please set opticCode.geminiApiKey in settings');
    return;
  }
  const ai = new GoogleGenAI({ apiKey });
  const systemInstructions = `You are Optic Code, a friendly and knowledgeable AI assistant specialized in coding. Balance conciseness with clarity in your responses:

1. For code explanation queries: Provide sufficient explanation to ensure understanding - include purpose, logic flow, and key concepts, but avoid excessive detail unless requested.

2. For implementation tasks: Focus on delivering high-quality, well-structured code with essential comments. Include brief explanations of complex logic or architectural decisions.

3. For UI implementations: Always provide modern, beautiful UI designs with clean layouts, appropriate spacing, accessibility features, and subtle animations where relevant. Follow current design trends and best practices.

4. Keep answers focused on the specific question without unnecessary background information.`;
  const promptText = `${systemInstructions}\n\nWorkspace context:\n${context.join('\n')}\n--\nUser request: ${userPrompt}`;
  const contents = inlineImage
    ? [ { inlineData: { mimeType: inlineImage.mimeType, data: inlineImage.data } }, promptText ]
    : promptText;
  const responseStream = await ai.models.generateContentStream({ model: 'gemini-2.0-flash', contents });
  for await (const chunk of responseStream) {
    yield chunk.text;
  }
}

/**
 * Selects necessary files for a query using Gemini 1.5 flash 8B.
 */
export async function classifyQueryIntent(query: string, fileList: string[]): Promise<string[]> {
  const config = vscode.workspace.getConfiguration('opticCode');
  const apiKey = config.get<string>('geminiApiKey');
  if (!apiKey) {
    vscode.window.showErrorMessage('Please set opticCode.geminiApiKey in settings');
    return [];
  }
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `You are a code assistant. Given this question and a list of project files, return a JSON array of filenames required to answer.\nQuestion: "${query}"\nFiles: ${JSON.stringify(fileList)}\nRespond ONLY with a JSON array of filenames.`;
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-8b',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
    }
  });
  try {
    return JSON.parse(response.text);
  } catch {
    vscode.window.showErrorMessage('Failed to parse classification JSON.');
    return [];
  }
}

/**
 * Classifies the user query type: 'small_talk', 'explain_file', or 'code_query'.
 */
export async function classifyQueryType(query: string): Promise<string> {
  const config = vscode.workspace.getConfiguration('opticCode');
  const apiKey = config.get<string>('geminiApiKey');
  if (!apiKey) {
    vscode.window.showErrorMessage('Please set opticCode.geminiApiKey in settings');
    return 'code_query';
  }
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `You are a code assistant. Classify the following user query into one of three categories: "small_talk" (greetings), "explain_file" (explain current file), or "code_query" (code-related queries). Respond ONLY with a JSON object like {\"type\": \"<category>\"}. Query: "${query}"`;
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-8b',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: { type: Type.OBJECT, properties: { type: { type: Type.STRING } }, required: ['type'] }
    }
  });
  try {
    const obj = JSON.parse(response.text);
    return obj.type;
  } catch {
    vscode.window.showErrorMessage('Failed to parse query classification JSON.');
    return 'code_query';
  }
}

/**
 * Identifies additional files needed for a comprehensive answer.
 * Uses full context content as input.
 */
export async function classifyAdditionalContext(query: string, context: string[]): Promise<string[]> {
  const config = vscode.workspace.getConfiguration('opticCode');
  const apiKey = config.get<string>('geminiApiKey');
  if (!apiKey) {
    vscode.window.showErrorMessage('Please set opticCode.geminiApiKey in settings');
    return [];
  }
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Given the user query: "${query}" and the current context from files:\n${context.join('\n')}\nDetermine if additional files are needed. Return a JSON array of full file paths for any additional files. If none, return an empty array. Respond ONLY with the JSON array.`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
    }
  });
  try {
    return JSON.parse(response.text);
  } catch {
    vscode.window.showErrorMessage('Failed to parse additional context JSON.');
    return [];
  }
}
