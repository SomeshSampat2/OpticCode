# Optic Code

A VS Code extension that collects code context and applies AI-powered edits.

## Setup

1. `npm install`
2. `npm run compile`
3. Press F5 in VS Code to launch the extension host.

## Commands

- **Optic Code: Collect Context** — Collects AST/language-service context for the open workspace.
- **Optic Code: Apply AI Edit** — Sends context + user request to AI, then applies the returned edits in the active editor.

## Config

Place any custom rules in `.windsurfrules` at the workspace root.

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
