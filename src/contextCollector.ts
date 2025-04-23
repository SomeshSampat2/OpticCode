import * as vscode from 'vscode';

// Walks the workspace and collects simple context snippets from code files
export async function collectContext(): Promise<string[]> {
  // find all TS/JS files, excluding node_modules
  const files = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx,html,css,scss,less,json,md,yaml,yml,xml,java,py,kt,go,cpp,c,cs,php,rb,swift,rs}', '**/node_modules/**');
  const contexts: string[] = [];

  for (const file of files) {
    const doc = await vscode.workspace.openTextDocument(file);
    // take full file as context
    const content = doc.getText();
    contexts.push(`${file.fsPath}:\n${content}\n---`);
  }

  return contexts;
}

/**
 * Collect context only from specified file paths.
 */
export async function collectContextFor(filePaths: string[]): Promise<string[]> {
  const contexts: string[] = [];
  for (const path of filePaths) {
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path));
      const content = doc.getText();
      contexts.push(`${path}:\n${content}\n---`);
    } catch {
      // ignore missing or unreadable files
    }
  }
  return contexts;
}
