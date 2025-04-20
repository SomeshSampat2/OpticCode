import * as vscode from 'vscode';
import { fetch as undiciFetch } from 'undici';
(globalThis as any).fetch = undiciFetch;
import { GoogleGenAI } from '@google/genai';

// Gemini integration via VS Code configuration

/**
 * Generates AI-based edit instructions given workspace context and a user prompt.
 */
export async function generateEdit(context: string[], userPrompt: string): Promise<string> {
  // fetch API key from settings
  const config = vscode.workspace.getConfiguration('opticCode');
  const apiKey = config.get<string>('geminiApiKey');
  if (!apiKey) {
    vscode.window.showErrorMessage('Please set opticCode.geminiApiKey in settings');
    return '';
  }
  const ai = new GoogleGenAI({ apiKey });
  // personality for AI assistant
  const systemInstructions = `You are Optic Code, a friendly and knowledgeable AI assistant specialized in coding. You guide users through coding tasks, provide clear examples, and also answer personality-related questions with a warm, helpful tone.`;
  const prompt = `${systemInstructions}\n\nWorkspace context:\n${context.join('\n')}\n--\nUser request: ${userPrompt}`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt
    });
    return response.text;
  } catch (err) {
    vscode.window.showErrorMessage('AI request failed: ' + (err as Error).message);
    return '';
  }
}
