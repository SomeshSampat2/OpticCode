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
exports.generateEdit = void 0;
const vscode = __importStar(require("vscode"));
const undici_1 = require("undici");
globalThis.fetch = undici_1.fetch;
const genai_1 = require("@google/genai");
// Gemini integration via VS Code configuration
/**
 * Generates AI-based edit instructions given workspace context and a user prompt.
 */
async function generateEdit(context, userPrompt) {
    // fetch API key from settings
    const config = vscode.workspace.getConfiguration('opticCode');
    const apiKey = config.get('geminiApiKey');
    if (!apiKey) {
        vscode.window.showErrorMessage('Please set opticCode.geminiApiKey in settings');
        return '';
    }
    const ai = new genai_1.GoogleGenAI({ apiKey });
    // personality for AI assistant
    const systemInstructions = `You are Optic Code, a friendly and knowledgeable AI assistant specialized in coding. You guide users through coding tasks, provide clear examples, and also answer personality-related questions with a warm, helpful tone.`;
    const prompt = `${systemInstructions}\n\nWorkspace context:\n${context.join('\n')}\n--\nUser request: ${userPrompt}`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt
        });
        return response.text;
    }
    catch (err) {
        vscode.window.showErrorMessage('AI request failed: ' + err.message);
        return '';
    }
}
exports.generateEdit = generateEdit;
