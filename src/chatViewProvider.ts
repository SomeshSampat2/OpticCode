import * as vscode from 'vscode';
import * as path from 'path';
import { collectContext, collectContextFor } from './contextCollector';
import { generateEdit, generateEditStream, classifyQueryIntent, classifyQueryType, classifyAdditionalContext } from './aiClient';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly extensionUri: vscode.Uri) {}
  private conversationHistory: Array<{sender: 'user' | 'bot', text: string}> = [];
  private pendingInlineImage: { mimeType: string; data: string } | undefined = undefined;
  private allFilePaths: string[] = [];

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log('▶️ ChatViewProvider.resolveWebviewView called');
    // preload workspace files for custom context suggestions (only supported extensions)
    this.allFilePaths = (await vscode.workspace.findFiles(
      '**/*.{ts,js,tsx,jsx,html,css,scss,less,json,md,yaml,yml,xml,java,py,kt,kts,go,cpp,c,cs,php,rb,swift,rs}',
      '**/node_modules/**'
    )).map(u => u.fsPath);
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async message => {
      if (message.command === 'userPrompt') {
        this.conversationHistory.push({ sender: 'user', text: message.text });
        // display user message
        webviewView.webview.postMessage({ command: 'appendMessage', sender: 'user', text: message.text });
        // show loading shimmer phases
        webviewView.webview.postMessage({ command: 'startLoading', phases: ['Understanding the request', 'Finding the solution', 'Thinking', 'Almost ready'] });
        // generate AI response
        // classify query type with AI
        const query = message.text;
        const queryType = await classifyQueryType(query);
        let ctx: string[];
        let filePaths: string[];
        if (queryType === 'small_talk') {
          ctx = [];
          filePaths = [];
        } else {
            // code_query: include user-mentioned files and other relevant files
            const allUris = await vscode.workspace.findFiles(
              '**/*.{ts,js,tsx,jsx,html,css,scss,less,json,md,yaml,yml,xml,java,py,kt,go,cpp,c,cs,php,rb,swift,rs}',
              '**/node_modules/**'
            );
            const allPaths = allUris.map(u => u.fsPath);
            // extract file names mentioned by user with '@'
            const mentionMatches = [...query.matchAll(/@([^\s@]+)/g)].map(m => m[1]);
            const mentionPaths = allPaths.filter(p => mentionMatches.includes(path.basename(p)));
            // other files excluding mentioned ones
            const otherPaths = allPaths.filter(p => !mentionPaths.includes(p));
            // classify intent on remaining files
            const intentSelected = mentionMatches.length > 0
              ? await classifyQueryIntent(query, otherPaths)
              : await classifyQueryIntent(query, allPaths);
            const selectedPaths = mentionPaths.concat(intentSelected.filter(p => !mentionPaths.includes(p)));
            if (selectedPaths.length > 0) {
              ctx = await collectContextFor(selectedPaths);
              filePaths = selectedPaths;
            } else {
              const activeEditor = vscode.window.activeTextEditor;
              ctx = activeEditor ? await collectContextFor([activeEditor.document.fileName]) : [];
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
        for await (const chunk of generateEditStream(ctx, message.text, this.pendingInlineImage)) {
          responseText += chunk;
          webviewView.webview.postMessage({ command: 'streamChunk', text: chunk });
        }
        // stop loading effects
        webviewView.webview.postMessage({ command: 'stopLoading' });
        this.pendingInlineImage = undefined;
        webviewView.webview.postMessage({ command: 'clearImagePreview' });
        // show Larger context button for code queries
        if (queryType === 'code_query') {
          webviewView.webview.postMessage({ command: 'showLargerContextButton', query, context: ctx });
        }
        this.conversationHistory.push({ sender: 'bot', text: responseText });
      } else if (message.command === 'requestLargerContext') {
        const { query, context } = message;
        this.conversationHistory.push({ sender: 'user', text: `[Larger context] ${query}` });
        webviewView.webview.postMessage({ command: 'startLoading', phases: ['Assessing additional context', 'Fetching extra files', 'Reanalyzing', 'Almost there'] });
        const additionalFiles = await classifyAdditionalContext(query, context as string[]);
        let fullCtx = [...(context as string[])];
        if (additionalFiles.length > 0) {
          fullCtx = fullCtx.concat(await collectContextFor(additionalFiles));
          const fileNames = additionalFiles.map(fp => `**${path.basename(fp)}**`);
          webviewView.webview.postMessage({ command: 'appendMessage', sender: 'bot', text: `Additional context files (${additionalFiles.length}):\n${fileNames.join('\n')}` });
        } else {
          webviewView.webview.postMessage({ command: 'appendMessage', sender: 'bot', text: 'Additional context files (0): None' });
        }
        webviewView.webview.postMessage({ command: 'appendMessage', sender: 'bot', text: '### Answer with larger context:' });
        let largerText = '';
        for await (const chunk of generateEditStream(fullCtx, query)) {
          largerText += chunk;
          webviewView.webview.postMessage({ command: 'streamChunk', text: chunk });
        }
        webviewView.webview.postMessage({ command: 'stopLoading' });
        this.conversationHistory.push({ sender: 'bot', text: largerText });
      } else if (message.command === 'getFileList') {
        const q = (message.query || '').toLowerCase();
        const matches = this.allFilePaths.filter(fp => fp.toLowerCase().includes(q)).slice(0, 10);
        const fileNames = matches.map(fp => path.basename(fp));
        webviewView.webview.postMessage({ command: 'fileSuggestions', files: fileNames });
      } else if (message.command === 'attach') {
        // handle image attach
        if (message.type === 'image') {
          const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { Images: ['png','jpg','jpeg','webp','heic','heif'] }
          });
          if (uris && uris.length > 0) {
            const fileUri = uris[0];
            const bytes = await vscode.workspace.fs.readFile(fileUri);
            const base64 = Buffer.from(bytes).toString('base64');
            const ext = path.extname(fileUri.fsPath).slice(1).toLowerCase();
            let mimeType = '';
            switch (ext) {
              case 'png': mimeType = 'image/png'; break;
              case 'jpg':
              case 'jpeg': mimeType = 'image/jpeg'; break;
              case 'webp': mimeType = 'image/webp'; break;
              case 'heic': mimeType = 'image/heic'; break;
              case 'heif': mimeType = 'image/heif'; break;
              default: mimeType = 'application/octet-stream';
            }
            const dataUrl = `data:${mimeType};base64,${base64}`;
            this.pendingInlineImage = { mimeType, data: base64 };
            webviewView.webview.postMessage({ command: 'showImagePreview', dataUrl });
          }
        }
      }
    });
  }

  public getHtml(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline' https://cdnjs.cloudflare.com; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; img-src ${cspSource} data:;">
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
    .loading-container { position: relative; background: transparent; margin: 0.5em 0; border-radius: 0; align-self: stretch; width: 100%; max-width: 100%; }
    .loading-header { color: var(--vscode-editor-foreground); font-size: 0.65rem; padding: 0.1em 0.3em; }
    .loading-shimmer { display: flex; flex-direction: column; gap: 4px; margin: 0.5em 0; width: 100%; }
    .shimmer-line { width: 100%; background-color: #333; height: 8px; border-radius: 4px; overflow: hidden; position: relative; }
    .shimmer-line::before { content: ''; position: absolute; top: 0; left: -150px; width: 150px; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); animation: shimmer 1.5s infinite; animation-delay: var(--delay); }
    @keyframes shimmer { 0% { transform: translateX(0); } 100% { transform: translateX(300px); } }
    #input { display: flex; position: relative; padding: 10px; border-top: 1px solid var(--vscode-editorWidget-border); }
    .input-box { flex: 1; padding: 8px; padding-right: 3em; border: 1px solid var(--vscode-editorWidget-border); border-radius: 4px; font-size: 0.7rem; background-color: var(--vscode-input-background); color: var(--vscode-editor-foreground); outline: none; min-height: 1.5em; }
    .input-box:empty:before { content: attr(data-placeholder); color: var(--vscode-input-placeholderForeground); pointer-events: none; }
    /* Attach button styling */
    #attachBtn { position: absolute; top: 50%; right: 48px; transform: translateY(-50%); border: none; background: none; color: var(--vscode-button-foreground); cursor: pointer; padding: 0; font-size: 0.85rem; outline: none; }
    /* Attach menu styling */
    #attachMenu {
      position: absolute;
      bottom: 50px;
      right: 16px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: none;
      z-index: 100;
    }
    .attach-option {
      padding: 8px 12px;
      width: 100%;
      border: none;
      background: none;
      text-align: left;
      font-size: 0.7rem;
      color: var(--vscode-editor-foreground);
      cursor: pointer;
    }
    .attach-option:hover {
      background: var(--vscode-button-hoverBackground);
    }
    /* Image preview styling */
    #previewContainer {
      display: none;
      margin: 8px 10px;
      align-items: center;
    }
    /* Enlarged image preview */
    #previewContainer img {
      max-height: 150px;
      max-width: 150px;
      border-radius: 4px;
      margin-right: 8px;
    }
    #clearImageBtn {
      background: none;
      border: none;
      color: var(--vscode-button-foreground);
      cursor: pointer;
      font-size: 0.8rem;
      padding: 0;
    }
    /* Custom context suggestions */
    #suggestions {
      position: absolute;
      bottom: 3.2em;
      left: 10px;
      max-height: 150px;
      overflow-y: auto;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 4px;
      width: calc(100% - 20px);
      z-index: 200;
      display: none;
    }
    .suggestion-item {
      padding: 4px 8px;
      cursor: pointer;
      font-size: 0.7rem;
      color: var(--vscode-editor-foreground);
    }
    .suggestion-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/markdown-it/dist/markdown-it.min.js" nonce="${nonce}"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js" nonce="${nonce}"></script>
</head>
<body>
  <div id="messages"></div>
  <div id="suggestions"></div>
  <div id="previewContainer">
    <img id="previewImg" src="" />
    <button id="clearImageBtn">✕</button>
  </div>
  <div id="input">
    <div id="inputBox" class="input-box" contenteditable="true" data-placeholder="Type a message..."></div>
    <button id="attachBtn">＋</button>
    <button id="sendBtn">➤</button>
  </div>
  <div id="attachMenu">
    <button class="attach-option" data-type="image">📷 Image</button>
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
    const suggestionsDiv = document.getElementById('suggestions');
    const inputBox = document.getElementById('inputBox');
    // input handler for custom context mentions
    inputBox.addEventListener('input', e => {
      // ignore non-user input events (like programmatic content changes)
      if (!e.isTrusted) return;
      const sel = window.getSelection();
      const cursor = sel.anchorOffset;
      const val = inputBox.innerText.slice(0, cursor);
      const at = val.lastIndexOf('@');
      if (at >= 0) {
        const q = val.slice(at + 1);
        // hide when user finishes mention (space) or clears query
        if (q.endsWith(' ') || q.trim().length === 0) {
          suggestionsDiv.style.display = 'none';
        } else {
          vscode.postMessage({ command: 'getFileList', query: q });
          suggestionsDiv.style.display = 'block';
        }
      } else {
        suggestionsDiv.style.display = 'none';
      }
    });
    document.getElementById('sendBtn').addEventListener('click', () => {
      const text = inputBox.innerText.trim();
      if (text) {
        vscode.postMessage({ command: 'userPrompt', text });
        inputBox.innerHTML = '';
        document.getElementById('previewContainer').style.display = 'none';
        document.getElementById('previewImg').src = '';
      }
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
      } else if (msg.command === 'showImagePreview') {
        const container = document.getElementById('previewContainer');
        const img = document.getElementById('previewImg');
        img.src = msg.dataUrl;
        container.style.display = 'flex';
        return;
      } else if (msg.command === 'clearImagePreview') {
        const container = document.getElementById('previewContainer');
        container.style.display = 'none';
        return;
      } else if (msg.command === 'fileSuggestions') {
        suggestionsDiv.innerHTML = '';
        msg.files.forEach(f => {
          const item = document.createElement('div');
          item.textContent = f;
          item.className = 'suggestion-item';
          item.addEventListener('click', () => {
            // replace text after last '@' with selected file mention
            inputBox.focus();
            const curText = inputBox.innerText;
            const atIdx = curText.lastIndexOf('@');
            const before = atIdx >= 0 ? curText.slice(0, atIdx) : curText;
            inputBox.innerHTML = '';
            inputBox.appendChild(document.createTextNode(before));
            inputBox.appendChild(document.createTextNode('@'));
            const bold = document.createElement('b');
            bold.textContent = f;
            inputBox.appendChild(bold);
            inputBox.appendChild(document.createTextNode(' '));
            suggestionsDiv.style.display = 'none';
            // move caret to end of inputBox
            const range = document.createRange();
            range.selectNodeContents(inputBox);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          });
          suggestionsDiv.appendChild(item);
        });
        return;
      }
    });
    // toggle attach menu
    document.getElementById('attachBtn').addEventListener('click', () => {
      const menu = document.getElementById('attachMenu');
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });
    // handle attach options
    document.querySelectorAll('.attach-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        vscode.postMessage({ command: 'attach', type });
        document.getElementById('attachMenu').style.display = 'none';
      });
    });
    // clear preview on button click
    document.getElementById('clearImageBtn').addEventListener('click', () => {
      const container = document.getElementById('previewContainer');
      container.style.display = 'none';
      document.getElementById('previewImg').src = '';
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
