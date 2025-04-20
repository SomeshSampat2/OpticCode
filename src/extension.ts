import * as vscode from 'vscode';
import { ChatViewProvider } from './chatViewProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('▶️ Optic Code activated');
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'opticCode.chatView',
      new ChatViewProvider(context.extensionUri)
    )
  );
}

export function deactivate() {}
