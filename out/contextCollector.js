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
exports.collectContext = void 0;
const vscode = __importStar(require("vscode"));
// Walks the workspace and collects simple context snippets from code files
async function collectContext() {
    // find all TS/JS files, excluding node_modules
    const files = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx}', '**/node_modules/**');
    const contexts = [];
    for (const file of files) {
        const doc = await vscode.workspace.openTextDocument(file);
        // take first 10 lines of the file as a snippet
        const lines = doc.getText().split('\n').slice(0, 10);
        contexts.push(`${file.fsPath}:\n${lines.join('\n')}\n---`);
    }
    return contexts;
}
exports.collectContext = collectContext;
