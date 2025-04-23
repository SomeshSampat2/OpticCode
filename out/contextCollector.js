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
exports.collectContextFor = exports.collectContext = void 0;
const vscode = __importStar(require("vscode"));
// Walks the workspace and collects simple context snippets from code files
async function collectContext() {
    // find all TS/JS files, excluding node_modules
    const files = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx,html,css,scss,less,json,md,yaml,yml,xml,java,py,kt,kts,go,cpp,c,cs,php,rb,swift,rs}', '**/node_modules/**');
    const contexts = [];
    for (const file of files) {
        const doc = await vscode.workspace.openTextDocument(file);
        // take full file as context
        const content = doc.getText();
        contexts.push(`${file.fsPath}:\n${content}\n---`);
    }
    return contexts;
}
exports.collectContext = collectContext;
/**
 * Collect context only from specified file paths.
 */
async function collectContextFor(filePaths) {
    const contexts = [];
    for (const path of filePaths) {
        try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path));
            const content = doc.getText();
            contexts.push(`${path}:\n${content}\n---`);
        }
        catch {
            // ignore missing or unreadable files
        }
    }
    return contexts;
}
exports.collectContextFor = collectContextFor;
