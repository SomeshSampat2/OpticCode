import * as vscode from 'vscode';
import { collectContext } from './contextCollector';
import { generateEdit } from './aiClient';

// Applies AI-generated edits to the active editor
export async function applyEdit(document: vscode.TextDocument, selection: vscode.Selection): Promise<void> {
  const userPrompt = await vscode.window.showInputBox({ prompt: 'Describe the change you want' });
  if (!userPrompt) {
    return;
  }
  // gather workspace context
  const context = await collectContext();
  // generate AI edit instructions
  const instructions = await generateEdit(context, userPrompt);
  // display instructions in output channel
  const channel = vscode.window.createOutputChannel('Optic Code AI Edits');
  channel.clear();
  channel.append(instructions);
  channel.show();
}
