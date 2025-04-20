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
exports.applyEdit = void 0;
const vscode = __importStar(require("vscode"));
const contextCollector_1 = require("./contextCollector");
const aiClient_1 = require("./aiClient");
// Applies AI-generated edits to the active editor
async function applyEdit(document, selection) {
    const userPrompt = await vscode.window.showInputBox({ prompt: 'Describe the change you want' });
    if (!userPrompt) {
        return;
    }
    // gather workspace context
    const context = await (0, contextCollector_1.collectContext)();
    // generate AI edit instructions
    const instructions = await (0, aiClient_1.generateEdit)(context, userPrompt);
    // display instructions in output channel
    const channel = vscode.window.createOutputChannel('Optic Code AI Edits');
    channel.clear();
    channel.append(instructions);
    channel.show();
}
exports.applyEdit = applyEdit;
