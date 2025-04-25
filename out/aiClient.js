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
exports.classifyAdditionalContext = exports.classifyQueryType = exports.classifyQueryIntent = exports.generateEditStream = exports.generateEdit = void 0;
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
/**
 * Streams AI-based responses for a user prompt using Gemini streaming.
 */
async function* generateEditStream(context, userPrompt) {
    const config = vscode.workspace.getConfiguration('opticCode');
    const apiKey = config.get('geminiApiKey');
    if (!apiKey) {
        vscode.window.showErrorMessage('Please set opticCode.geminiApiKey in settings');
        return;
    }
    const ai = new genai_1.GoogleGenAI({ apiKey });
    const systemInstructions = `You are Optic Code, a friendly and knowledgeable AI assistant specialized in coding. You guide users through coding tasks, provide clear examples, and also answer personality-related questions with a warm, helpful tone.`;
    const prompt = `${systemInstructions}\n\nWorkspace context:\n${context.join('\n')}\n--\nUser request: ${userPrompt}`;
    const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.0-flash',
        contents: prompt
    });
    for await (const chunk of responseStream) {
        yield chunk.text;
    }
}
exports.generateEditStream = generateEditStream;
/**
 * Selects necessary files for a query using Gemini 1.5 flash 8B.
 */
async function classifyQueryIntent(query, fileList) {
    const config = vscode.workspace.getConfiguration('opticCode');
    const apiKey = config.get('geminiApiKey');
    if (!apiKey) {
        vscode.window.showErrorMessage('Please set opticCode.geminiApiKey in settings');
        return [];
    }
    const ai = new genai_1.GoogleGenAI({ apiKey });
    const prompt = `You are a code assistant. Given this question and a list of project files, return a JSON array of filenames required to answer.\nQuestion: "${query}"\nFiles: ${JSON.stringify(fileList)}\nRespond ONLY with a JSON array of filenames.`;
    const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash-8b',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } }
        }
    });
    try {
        return JSON.parse(response.text);
    }
    catch {
        vscode.window.showErrorMessage('Failed to parse classification JSON.');
        return [];
    }
}
exports.classifyQueryIntent = classifyQueryIntent;
/**
 * Classifies the user query type: 'small_talk', 'explain_file', or 'code_query'.
 */
async function classifyQueryType(query) {
    const config = vscode.workspace.getConfiguration('opticCode');
    const apiKey = config.get('geminiApiKey');
    if (!apiKey) {
        vscode.window.showErrorMessage('Please set opticCode.geminiApiKey in settings');
        return 'code_query';
    }
    const ai = new genai_1.GoogleGenAI({ apiKey });
    const prompt = `You are a code assistant. Classify the following user query into one of three categories: "small_talk" (greetings), "explain_file" (explain current file), or "code_query" (code-related queries). Respond ONLY with a JSON object like {\"type\": \"<category>\"}. Query: "${query}"`;
    const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash-8b',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: { type: genai_1.Type.OBJECT, properties: { type: { type: genai_1.Type.STRING } }, required: ['type'] }
        }
    });
    try {
        const obj = JSON.parse(response.text);
        return obj.type;
    }
    catch {
        vscode.window.showErrorMessage('Failed to parse query classification JSON.');
        return 'code_query';
    }
}
exports.classifyQueryType = classifyQueryType;
/**
 * Identifies additional files needed for a comprehensive answer.
 * Uses full context content as input.
 */
async function classifyAdditionalContext(query, context) {
    const config = vscode.workspace.getConfiguration('opticCode');
    const apiKey = config.get('geminiApiKey');
    if (!apiKey) {
        vscode.window.showErrorMessage('Please set opticCode.geminiApiKey in settings');
        return [];
    }
    const ai = new genai_1.GoogleGenAI({ apiKey });
    const prompt = `You are a code assistant. Given the user query: "${query}" and the current context from files:\n${context.join('\n')}\nDetermine if additional files are needed. Return a JSON array of full file paths for any additional files. If none, return an empty array. Respond ONLY with the JSON array.`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } }
        }
    });
    try {
        return JSON.parse(response.text);
    }
    catch {
        vscode.window.showErrorMessage('Failed to parse additional context JSON.');
        return [];
    }
}
exports.classifyAdditionalContext = classifyAdditionalContext;
