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
