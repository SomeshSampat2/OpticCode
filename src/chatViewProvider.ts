import * as vscode from 'vscode';
import { collectContext } from './contextCollector';
import { generateEdit } from './aiClient';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log('▶️ ChatViewProvider.resolveWebviewView called');
    webviewView.webview.options = {
      enableScripts: true,
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async message => {
      if (message.command === 'userPrompt') {
        // display user message
        webviewView.webview.postMessage({ command: 'appendMessage', sender: 'user', text: message.text });
        // generate AI response
        // start with workspace context
        const ctx = await collectContext();
        // prepend active file content
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
          const doc = activeEditor.document;
          ctx.unshift(`${doc.fileName}:\n${doc.getText()}\n---`);
        }
        const resp = await generateEdit(ctx, message.text);
        webviewView.webview.postMessage({ command: 'appendMessage', sender: 'bot', text: resp });
      }
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline' https://cdnjs.cloudflare.com; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/atom-one-dark.min.css">
  <title>Optic Code Chat</title>
  <style>
    body { font-family: var(--vscode-editor-font-family); color: var(--vscode-editor-foreground); margin: 0; display: flex; flex-direction: column; height: 100vh; }
    #messages { flex: 1; padding: 10px; overflow-y: auto; display: flex; flex-direction: column; }
    .message { max-width: 80%; margin: 5px 0; padding: 10px; border-radius: 8px; word-wrap: break-word; }
    .user { align-self: flex-end; background-color: var(--vscode-editor-widget-background); }
    .bot { align-self: flex-start; background-color: var(--vscode-input-background); }
    .code-container { position: relative; background: #2B2B2B; margin: 1em 0; border-radius: 8px; overflow: hidden; }
    .code-header { background: #313335; color: #BBB; font-size: 0.85em; padding: 0.2em 0.5em; display: flex; justify-content: space-between; align-items: center; }
    .code-header .lang { font-weight: bold; }
    .code-header .copy-btn { cursor: pointer; color: #BBB; }
    .code-container pre { margin: 0; background: transparent; padding: 1em; overflow: auto; }
    .code-container code { background: transparent; }
    #input { display: flex; padding: 10px; border-top: 1px solid var(--vscode-editorWidget-border); }
    #inputBox { flex: 1; padding: 8px; border: 1px solid var(--vscode-editorWidget-border); border-radius: 4px; }
    #sendBtn { margin-left: 8px; padding: 8px 12px; border: none; border-radius: 4px; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); cursor: pointer; }
    #sendBtn:hover { background-color: var(--vscode-button-hoverBackground); }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/markdown-it/dist/markdown-it.min.js" nonce="${nonce}"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js" nonce="${nonce}"></script>
</head>
<body>
  <div id="messages"></div>
  <div id="input">
    <input type="text" id="inputBox" placeholder="Type a message..." />
    <button id="sendBtn">Send</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    // initialize markdown-it
    const md = window.markdownit({ html: true, linkify: true, typographer: true });
    const messagesDiv = document.getElementById('messages');
    document.getElementById('sendBtn').addEventListener('click', () => {
      const input = document.getElementById('inputBox');
      const text = input.value;
      if (text) { vscode.postMessage({ command: 'userPrompt', text }); input.value = ''; }
    });
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'appendMessage') {
        const div = document.createElement('div');
        div.className = 'message ' + (msg.sender === 'user' ? 'user' : 'bot');
        div.innerHTML = md.render(msg.text);
        messagesDiv.appendChild(div);
        // apply syntax highlighting to all code blocks
        hljs.highlightAll();
        // wrap code blocks
        div.querySelectorAll('pre code').forEach(block => {
          const pre = block.parentElement;
          const lang = block.className.replace(/hljs\\s*/,'') || 'code';
          const container = document.createElement('div');
          container.className = 'code-container';
          const header = document.createElement('div');
          header.className = 'code-header';
          const langSpan = document.createElement('span');
          langSpan.className = 'lang';
          langSpan.textContent = lang;
          header.appendChild(langSpan);
          const copyBtn = document.createElement('span');
          copyBtn.className = 'copy-btn';
          copyBtn.textContent = '📋 Copy';
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(block.innerText).then(() => {
              copyBtn.textContent = '📋 Copied';
              setTimeout(() => copyBtn.textContent = '📋 Copy', 2000);
            });
          };
          header.appendChild(copyBtn);
          pre.parentNode.replaceChild(container, pre);
          container.appendChild(header);
          container.appendChild(pre);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }
    });
  </script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
