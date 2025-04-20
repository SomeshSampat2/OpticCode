import * as vscode from 'vscode';
import { ChatViewProvider } from './chatViewProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('▶️ Optic Code activated');
  // register sidebar chat provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'opticCode.chatView',
      new ChatViewProvider(context.extensionUri)
    )
  );

  // register command to open chat panel on the right
  context.subscriptions.push(
    vscode.commands.registerCommand('opticCode.openChat', () => {
      const panel = vscode.window.createWebviewPanel(
        'opticCode.chatPanel',
        'Optic Code Chat',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
        { enableScripts: true, localResourceRoots: [context.extensionUri] }
      );
      panel.webview.html = new ChatViewProvider(context.extensionUri).getHtml(panel.webview);
    })
  );

  // add status bar icon to open chat
  const chatStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  chatStatusBar.text = '$(comment-discussion)';
  chatStatusBar.tooltip = 'Open Optic Code Chat';
  chatStatusBar.command = 'opticCode.openChat';
  chatStatusBar.show();
  context.subscriptions.push(chatStatusBar);
}

export function deactivate() {}
