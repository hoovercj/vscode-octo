'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionContext, TextDocumentContentProvider, EventEmitter, Event, Uri, ViewColumn } from 'vscode';
import * as fs from 'fs';
import * as Octo from './octo';
import * as cp from 'child_process';

// import OctoSymbolProvider from './octoSymbolProvider';
import OctoLanguageService from './OctoLanguageService';
import OctoTools from './octoTools';

let extensionContext: ExtensionContext;
export function activate(context: ExtensionContext) {
    extensionContext = context;

    vscode.languages.setLanguageConfiguration('octo', {
        comments: {
            lineComment: "#"
        },
        wordPattern: /([\S]+)/g
    });

    let octoTools = new OctoTools(context);
    octoTools.register();

    let languageService = new OctoLanguageService(context);
    languageService.register();

    // Process known files
    vscode.workspace.textDocuments.forEach(document => {
        if (isOctoFile(document)) {
            languageService.open(document)
            languageService.update(document);
        }
    });

    vscode.workspace.onDidOpenTextDocument(document => {
        if (isOctoFile(document)) {
            languageService.open(document)
            languageService.update(document);
        }
    });

    vscode.workspace.onDidChangeTextDocument(event => {
        if (isOctoFile(event.document)) {
            OctoTools.update(event.document.uri);
            languageService.update(event.document);
        }
    });
    // TODO onClose as well

    vscode.workspace.onDidChangeConfiguration(() => {
        vscode.workspace.textDocuments.forEach((document) => {
            if (isOctoFile) {
                OctoTools.update(document.uri);
                languageService.update(document);
            }
        });
    });
}

function isOctoFile(document: vscode.TextDocument) {
    return document.languageId === 'octo'
        && document.uri.scheme !== 'octo'; // prevent processing of own documents
}
