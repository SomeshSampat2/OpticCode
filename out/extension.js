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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const chatViewProvider_1 = require("./chatViewProvider");
function activate(context) {
    console.log('▶️ Optic Code activated');
    // Ensure extension resources are available
    try {
        const resourcePath = vscode.Uri.joinPath(context.extensionUri, 'resources');
        const libPath = vscode.Uri.joinPath(resourcePath, 'lib');
        console.log('📦 Resource path:', resourcePath.fsPath);
        console.log('📚 Library path:', libPath.fsPath);
    }
    catch (error) {
        console.error('❌ Error accessing extension resources:', error);
    }
    // register sidebar chat provider
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('opticCode.chatView', new chatViewProvider_1.ChatViewProvider(context.extensionUri)));
    // register command to open chat panel on the right
    context.subscriptions.push(vscode.commands.registerCommand('opticCode.openChat', () => {
        const panel = vscode.window.createWebviewPanel('opticCode.chatPanel', 'Optic Code Chat', { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false }, { enableScripts: true, localResourceRoots: [context.extensionUri] });
        panel.webview.html = new chatViewProvider_1.ChatViewProvider(context.extensionUri).getHtml(panel.webview);
    }));
    // add status bar icon to open chat
    const chatStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    chatStatusBar.text = '$(comment-discussion)';
    chatStatusBar.tooltip = 'Open Optic Code Chat';
    chatStatusBar.command = 'opticCode.openChat';
    chatStatusBar.show();
    context.subscriptions.push(chatStatusBar);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
