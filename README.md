# Optic Code

## Installation

Install from VS Code Marketplace:

1. Open Extensions (⇧⌘X or Ctrl+Shift+X).
2. Search for **Optic Code**.
3. Click **Install**.

Or via CLI:

```bash
code --install-extension SomeshSampat.optic-code
```

## Configuration

### Gemini API Key

1. Open **Settings** (⇧⌘, or Ctrl+,).
2. Search for `Optic Code: Gemini Api Key`.
3. Paste your API key.

## Features

- **Context-Aware Chat**: Discuss and navigate your code with AI.
- **AI-Powered Edits**: Apply contextual refactorings inline.
- **File Mentions**: Type `@filename` to include that file's context.
- **Image Attachments**: Attach screenshots in your chat.

### 📦 Resources
- **Icon**: `resources/icon.svg`
- **Screenshots**: Add usage images to `resources/screenshots/`

### 🚀 Release Notes
- **1.0.0**: Initial public release with context-aware chat and AI-powered code editing.

### 📢 Publishing Guide
Follow these steps to publish your extension to the VS Code Marketplace:
1. Install the VS Code Extension Manager:
   ```bash
   npm install -g @vscode/vsce
   ```
2. Authenticate with your publisher ID:
   ```bash
   vsce login "Somesh Sampat"
   ```
   _Enter your Personal Access Token (PAT) when prompted._
3. (Optional) Package locally to verify content:
   ```bash
   vsce package
   ```
4. Publish to Marketplace:
   ```bash
   vsce publish
   ```
   _Ensure `package.json` has the correct `publisher` and `version` before publishing._
