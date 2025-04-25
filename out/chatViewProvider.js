"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const contextCollector_1 = require("./contextCollector");
const aiClient_1 = require("./aiClient");
class ChatViewProvider {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
        this.conversationHistory = [];
    }
    resolveWebviewView(webviewView, context, _token) {
        console.log('▶️ ChatViewProvider.resolveWebviewView called');
        webviewView.webview.options = {
            enableScripts: true,
        };
        webviewView.webview.html = this.getHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'userPrompt') {
                this.conversationHistory.push({ sender: 'user', text: message.text });
                // display user message
                webviewView.webview.postMessage({ command: 'appendMessage', sender: 'user', text: message.text });
                // show loading shimmer phases
                webviewView.webview.postMessage({ command: 'startLoading', phases: ['Understanding the request', 'Finding the solution', 'Thinking', 'Almost ready'] });
                // generate AI response
                // classify query type with AI
                const query = message.text;
                const queryType = await (0, aiClient_1.classifyQueryType)(query);
                let ctx;
                let filePaths;
                if (queryType === 'small_talk') {
                    ctx = [];
                    filePaths = [];
                }
                else if (queryType === 'explain_file') {
                    const activeEditor = vscode.window.activeTextEditor;
                    ctx = activeEditor ? await (0, contextCollector_1.collectContextFor)([activeEditor.document.fileName]) : [];
                    filePaths = activeEditor ? [activeEditor.document.fileName] : [];
                }
                else {
                    // code_query: select relevant files
                    const allUris = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx,html,css,scss,less,json,md,yaml,yml,xml,java,py,kt,go,cpp,c,cs,php,rb,swift,rs}', '**/node_modules/**');
                    const allPaths = allUris.map(u => u.fsPath);
                    const selected = await (0, aiClient_1.classifyQueryIntent)(query, allPaths);
                    if (selected.length > 0) {
                        ctx = await (0, contextCollector_1.collectContextFor)(selected);
                        filePaths = selected;
                    }
                    else {
                        const activeEditor = vscode.window.activeTextEditor;
                        ctx = activeEditor ? await (0, contextCollector_1.collectContextFor)([activeEditor.document.fileName]) : [];
                        filePaths = activeEditor ? [activeEditor.document.fileName] : [];
                    }
                }
                if (this.conversationHistory.length > 0) {
                    const historyText = this.conversationHistory.map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n');
                    ctx.unshift('Conversation History:\n' + historyText);
                }
                // display file list and count (bold names only)
                const fileNames = filePaths.map(fp => `**${path.basename(fp)}**`);
                const fileListText = filePaths.length > 0
                    ? `Context files (${filePaths.length}):\n${fileNames.join('\n')}`
                    : 'Context files (0): None';
                webviewView.webview.postMessage({ command: 'appendMessage', sender: 'bot', text: fileListText });
                let responseText = '';
                // stream AI response in real-time
                for await (const chunk of (0, aiClient_1.generateEditStream)(ctx, message.text)) {
                    responseText += chunk;
                    webviewView.webview.postMessage({ command: 'streamChunk', text: chunk });
                }
                // stop loading effects
                webviewView.webview.postMessage({ command: 'stopLoading' });
                // show Larger context button for code queries
                if (queryType === 'code_query') {
                    webviewView.webview.postMessage({ command: 'showLargerContextButton', query, context: ctx });
                }
                this.conversationHistory.push({ sender: 'bot', text: responseText });
            }
            else if (message.command === 'requestLargerContext') {
                const { query, context } = message;
                this.conversationHistory.push({ sender: 'user', text: `[Larger context] ${query}` });
                webviewView.webview.postMessage({ command: 'startLoading', phases: ['Assessing additional context', 'Fetching extra files', 'Reanalyzing', 'Almost there'] });
                const additionalFiles = await (0, aiClient_1.classifyAdditionalContext)(query, context);
                let fullCtx = [...context];
                if (additionalFiles.length > 0) {
                    fullCtx = fullCtx.concat(await (0, contextCollector_1.collectContextFor)(additionalFiles));
                    const fileNames = additionalFiles.map(fp => `**${path.basename(fp)}**`);
                    webviewView.webview.postMessage({ command: 'appendMessage', sender: 'bot', text: `Additional context files (${additionalFiles.length}):\n${fileNames.join('\n')}` });
                }
                else {
                    webviewView.webview.postMessage({ command: 'appendMessage', sender: 'bot', text: 'Additional context files (0): None' });
                }
                webviewView.webview.postMessage({ command: 'appendMessage', sender: 'bot', text: '### Answer with larger context:' });
                let largerText = '';
                for await (const chunk of (0, aiClient_1.generateEditStream)(fullCtx, query)) {
                    largerText += chunk;
                    webviewView.webview.postMessage({ command: 'streamChunk', text: chunk });
                }
                webviewView.webview.postMessage({ command: 'stopLoading' });
                this.conversationHistory.push({ sender: 'bot', text: largerText });
            }
        });
    }
    getHtml(webview) {
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
    .larger-context-btn {
      display: inline-block;
      margin: 12px auto;
      padding: 8px 16px;
      border: 1px solid var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 500;
      text-align: center;
      transition: background 0.2s ease, transform 0.1s ease;
      cursor: pointer;
    }
    .larger-context-btn:hover {
      background: var(--vscode-button-hoverBackground);
      transform: translateY(-1px);
    }
    .larger-context-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    body { font-family: var(--vscode-editor-font-family); color: var(--vscode-editor-foreground); margin: 0; display: flex; flex-direction: column; height: 100vh; font-size: 0.7rem; }
    #messages { flex: 1; padding: 10px; overflow-y: auto; display: flex; flex-direction: column; }
    .message { max-width: 80%; margin: 5px 0; padding: 6px; border-radius: 8px; word-wrap: break-word; font-size: 0.7rem; }
    .user { align-self: flex-end; background-color: var(--vscode-input-background); padding: 1px 6px; margin: 2px 0; }
    .bot { align-self: flex-start; background-color: transparent; max-width: 100%; padding-right: 0; }
    .code-container { position: relative; background: #2B2B2B; margin: 1em 0; border-radius: 8px; overflow: hidden; }
    .code-header { background: #313335; color: #BBB; font-size: 0.75rem; padding: 0.2em 0.5em; display: flex; justify-content: space-between; align-items: center; }
    .code-header .lang { font-weight: bold; }
    .code-header .copy-btn { cursor: pointer; color: #BBB; }
    .code-container pre { margin: 0; background: transparent; padding: 1em; overflow: auto; }
    .code-container code { background: transparent; }
    .loading-container { position: relative; background: transparent; margin: 0.5em 0; border-radius: 0; }
    .loading-header { color: var(--vscode-editor-foreground); font-size: 0.65rem; padding: 0.1em 0.3em; }
    .loading-shimmer { display: flex; flex-direction: column; gap: 4px; margin: 0.5em 0; }
    .shimmer-line { width: 100%; background-color: #333; height: 8px; border-radius: 4px; overflow: hidden; position: relative; }
    .shimmer-line::before { content: ''; position: absolute; top: 0; left: -150px; width: 150px; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); animation: shimmer 1.5s infinite; animation-delay: var(--delay); }
    @keyframes shimmer { 0% { transform: translateX(0); } 100% { transform: translateX(300px); } }
    #input { display: flex; position: relative; padding: 10px; border-top: 1px solid var(--vscode-editorWidget-border); }
    #inputBox { flex: 1; padding: 8px; padding-right: 3em; border: 1px solid var(--vscode-editorWidget-border); border-radius: 4px; font-size: 0.7rem; background-color: var(--vscode-input-background); color: var(--vscode-editor-foreground); outline: none; }
    #sendBtn { position: absolute; top: 50%; right: 16px; transform: translateY(-50%); border: none; background: none; color: var(--vscode-button-foreground); cursor: pointer; padding: 0; font-size: 0.85rem; outline: none; }
    #inputBox:focus, #sendBtn:focus { outline: none; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/markdown-it/dist/markdown-it.min.js" nonce="${nonce}"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js" nonce="${nonce}"></script>
</head>
<body>
  <div id="messages"></div>
  <div id="input">
    <input type="text" id="inputBox" placeholder="Type a message..." />
    <button id="sendBtn">➤</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    // initialize markdown-it
    const md = window.markdownit({ html: true, linkify: true, typographer: true });
    const messagesDiv = document.getElementById('messages');
    let loadingDiv = null;
    let dotInterval = null;
    let phaseInterval = null;
    let streamDiv = null;
    let streamBuffer = '';
    document.getElementById('sendBtn').addEventListener('click', () => {
      const input = document.getElementById('inputBox');
      const text = input.value;
      if (text) { vscode.postMessage({ command: 'userPrompt', text }); input.value = ''; }
    });
    // send on Enter key
    document.getElementById('inputBox').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('sendBtn').click();
      }
    });
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'startLoading') {
        // clear previous answer buffer and element
        streamBuffer = '';
        streamDiv = null;
        if (loadingDiv) loadingDiv.remove();
        loadingDiv = document.createElement('div');
        loadingDiv.className = 'message bot loading-container';
        const header = document.createElement('div');
        header.className = 'loading-header';
        loadingDiv.appendChild(header);
        // create multiline shimmer
        const shimmerContainer = document.createElement('div');
        shimmerContainer.className = 'loading-shimmer';
        for (let i = 0; i < 5; i++) {
          const line = document.createElement('div');
          line.className = 'shimmer-line';
          const delay = Math.random() + 's';
          line.style.setProperty('--delay', delay);
          const width = Math.floor(Math.random() * 50 + 50) + '%';
          line.style.width = width;
          shimmerContainer.appendChild(line);
        }
        loadingDiv.appendChild(shimmerContainer);
        messagesDiv.appendChild(loadingDiv);
        // animate header text and dots
        let phaseIndex = 0, dotCount = 0;
        header.textContent = msg.phases[0];
        dotInterval = setInterval(() => {
          dotCount = (dotCount % 3) + 1;
          header.textContent = msg.phases[phaseIndex] + '.'.repeat(dotCount);
        }, 500);
        phaseInterval = setInterval(() => {
          if (phaseIndex < msg.phases.length - 1) {
            phaseIndex++;
            dotCount = 0;
          } else {
            clearInterval(phaseInterval);
          }
        }, 2000);
        return;
      } else if (msg.command === 'stopLoading') {
        clearInterval(dotInterval);
        clearInterval(phaseInterval);
        if (loadingDiv) loadingDiv.remove(); loadingDiv = null; streamDiv = null;
        return;
      } else if (msg.command === 'streamChunk') {
        // on first chunk, clear loading shimmer
        if (loadingDiv) {
          clearInterval(dotInterval);
          clearInterval(phaseInterval);
          loadingDiv.remove();
          loadingDiv = null;
        }
        if (!streamDiv) {
          streamDiv = document.createElement('div');
          streamDiv.className = 'message bot';
          messagesDiv.appendChild(streamDiv);
        }
        streamBuffer += msg.text;
        streamDiv.innerHTML = md.render(streamBuffer);
        hljs.highlightAll();
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return;
      } else if (msg.command === 'appendMessage') {
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
      } else if (msg.command === 'showLargerContextButton') {
        const btn = document.createElement('button');
        btn.textContent = '🔍 Larger context';
        btn.className = 'larger-context-btn';
        messagesDiv.appendChild(btn);
        btn.addEventListener('click', () => {
          btn.disabled = true;
          btn.textContent = '🔄 Loading larger context...';
          vscode.postMessage({ command: 'requestLargerContext', query: msg.query, context: msg.context });
        });
        return;
      }
    });
  </script>
</body>
</html>`;
    }
    getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
exports.ChatViewProvider = ChatViewProvider;
