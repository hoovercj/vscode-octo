'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionContext, TextDocumentContentProvider, EventEmitter, Event, Uri, ViewColumn } from 'vscode';
import * as fs from 'fs';
import * as Octo from './octo';
import * as cp from 'child_process';
import { ThrottledDelayer } from './utils/async';

// import OctoSymbolProvider from './octoSymbolProvider';
import OctoLanguageService from './octoLanguageService';
import OctoTools from './octoTools';

let extensionContext: ExtensionContext;
let delayers: { [key: string]: ThrottledDelayer<void> };
let octoTools: OctoTools;
let languageService: OctoLanguageService;

export function activate(context: ExtensionContext) {
    extensionContext = context;
    delayers = Object.create(null);
    
    vscode.languages.setLanguageConfiguration('octo', {
        comments: {
            lineComment: "#"
        },
        wordPattern: /([\S]+)/g
    });

    octoTools = new OctoTools(context);
    octoTools.register();

    languageService = new OctoLanguageService(context);
    configureLanguageService();
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
            onUpdate(document);
        }
    });

    vscode.workspace.onDidChangeTextDocument(event => {
        if (isOctoFile(event.document)) {
            onUpdate(event.document);
        }
    });

    vscode.workspace.onDidChangeConfiguration(() => {
        configureLanguageService();
        vscode.workspace.textDocuments.forEach((document) => {
            if (isOctoFile) {
                OctoTools.update(document.uri);
                languageService.update(document);
            }
        });
    });
}

function onUpdate(document: vscode.TextDocument) {
    let key = document.uri.toString();
    let delayer = delayers[key];
    if (!delayer) {
        delayer = new ThrottledDelayer<void>(250);
        delayers[key] = delayer;
    }
    delayer.trigger(() => {
        return Promise.resolve().then(() => {
            OctoTools.update(document.uri);
            languageService.update(document);
        })
    });
}

function configureLanguageService() {
    let config = vscode.workspace.getConfiguration('octo');
    let mode = config.get('languageService', 'enabled');
    languageService.setMode(mode);
}

function isOctoFile(document: vscode.TextDocument) {
    return document.languageId === 'octo'
        && document.uri.scheme !== 'octo'; // prevent processing of own documents
}
