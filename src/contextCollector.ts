import * as vscode from 'vscode';

// Walks the workspace and collects simple context snippets from code files
export async function collectContext(): Promise<string[]> {
  // find all TS/JS files, excluding node_modules
  const files = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx}', '**/node_modules/**');
  const contexts: string[] = [];

  for (const file of files) {
    const doc = await vscode.workspace.openTextDocument(file);
    // take first 10 lines of the file as a snippet
    const lines = doc.getText().split('\n').slice(0, 10);
    contexts.push(`${file.fsPath}:\n${lines.join('\n')}\n---`);
  }

  return contexts;
}
