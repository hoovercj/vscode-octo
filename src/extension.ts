'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionContext, TextDocumentContentProvider, EventEmitter, Event, Uri, ViewColumn } from 'vscode';
import * as fs from 'fs';
import * as Octo from './octo';
import * as cp from 'child_process';

import OctoSymbolProvider from './octoSymbolProvider';
import OctoTools from './octoTools';

let extensionContext: ExtensionContext;
export function activate(context: ExtensionContext) {
    extensionContext = context;
    let octoTools = new OctoTools(context);
    octoTools.register();
    
    let symbolProvider = new OctoSymbolProvider(context);
    symbolProvider.register();
}

