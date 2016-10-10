'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionContext, TextDocumentContentProvider, EventEmitter, Event, Uri, ViewColumn } from 'vscode';
import * as fs from 'fs';
import * as Octo from './octo';

let extensionContext: ExtensionContext;
export function activate(context: ExtensionContext) {
    extensionContext = context;
    let provider = new OctoDocumentContentProvider();
    let registration = vscode.workspace.registerTextDocumentContentProvider('octo', provider);

    let d1 = vscode.commands.registerCommand('octo.showPreview', showPreview);
    let d2 = vscode.commands.registerCommand('octo.showPreviewToSide', uri => showPreview(uri, true));
    let d3 = vscode.commands.registerCommand('octo.showSource', showSource);
    let d4 = vscode.commands.registerCommand('octo.openDocs', openDoc);
    let d5 = vscode.commands.registerCommand('octo.openExample', openExample);

    context.subscriptions.push(d1, d2, d3, d4, d5, registration);

    vscode.workspace.onDidSaveTextDocument(document => {
        if (isOctoFile(document)) {
            const uri = getOctoUri(document.uri);
            provider.update(uri);
        }
    });

    vscode.workspace.onDidChangeTextDocument(event => {
        if (isOctoFile(event.document)) {
            const uri = getOctoUri(event.document.uri);
            provider.update(uri);
        }
    });

    vscode.workspace.onDidChangeConfiguration(() => {
        vscode.workspace.textDocuments.forEach((document) => {
            if (isOctoFile) {
                provider.update(document.uri);
            }
        });
    });
}

function isOctoFile(document: vscode.TextDocument) {
    return document.languageId === 'octo'
        && document.uri.scheme !== 'octo'; // prevent processing of own documents
}

function getOctoUri(uri: Uri) {
    return uri.with({ scheme: 'octo', path: uri.path + '.compiled', query: uri.path });
}

function getFileUri(path: string) {
    return new vscode.Uri().with({ scheme: 'file', path: path });
}

function getOctoPath(file?: string) {
    return extensionContext.asAbsolutePath(path.join('octo', file || ''));
}

function getViewColumn(sideBySide): ViewColumn {
    const active = vscode.window.activeTextEditor;
    if (!active) {
        return ViewColumn.One;
    }

    if (!sideBySide) {
        return active.viewColumn;
    }

    switch (active.viewColumn) {
        case ViewColumn.One:
            return ViewColumn.Two;
        case ViewColumn.Two:
            return ViewColumn.Three;
    }

    return active.viewColumn;
}

function showPreview(uri?: Uri, sideBySide: boolean = false) {

    let resource = uri;
    if (!(resource instanceof Uri)) {
        if (vscode.window.activeTextEditor) {
            // we are relaxed and don't check for octo files
            resource = vscode.window.activeTextEditor.document.uri;
        }
    }

    if (!(resource instanceof Uri)) {
        if (!vscode.window.activeTextEditor) {
            // this is most likely toggling the preview
            return vscode.commands.executeCommand('octo.showSource');
        }
        // nothing found that could be shown or toggled
        return;
    }
    let thenable = vscode.commands.executeCommand('vscode.previewHtml',
        getOctoUri(resource),
        getViewColumn(sideBySide),
        `Preview '${path.basename(resource.fsPath)}'`);

    return thenable;
}

function showSource(mdUri: Uri) {
    if (!mdUri) {
        return vscode.commands.executeCommand('workbench.action.navigateBack');
    }

    const docUri = Uri.parse(mdUri.query);
    for (let editor of vscode.window.visibleTextEditors) {
        if (editor.document.uri.toString() === docUri.toString()) {
            return vscode.window.showTextDocument(editor.document, editor.viewColumn);
        }
    }

    return vscode.workspace.openTextDocument(docUri).then(doc => vscode.window.showTextDocument(doc));
}

function openDoc(): void {
    var dir = path.join('docs', '_site');
    var doc = showQuickPickForDir(dir);
    var selectedFilename;
    if (doc) {
        doc.then(filename => {
            selectedFilename = filename.split('.')[0];
            return vscode.workspace.openTextDocument(getFileUri(getOctoPath(path.join(dir, filename))))
        }).then(document => vscode.commands.executeCommand('vscode.previewHtml',
            document.uri,
            getViewColumn(true),
            `Octo Docs: ${selectedFilename}`));
    }
}

function openExample(): void {
    var dir = 'examples';
    var promise = showQuickPickForDir(dir);
    var selectedFilename;

    if (!promise) return;

    promise.then(filename => {
        if (!filename) return;
        selectedFilename = filename.split('.')[0];
        return vscode.workspace.openTextDocument(getFileUri(getOctoPath(path.join(dir, filename))))
    }).then(document => vscode.window.showTextDocument(document));
}

function showQuickPickForDir(dir): Thenable<string> {
    var files = fs.readdirSync(getOctoPath(dir));
    if (!files) return;

    return vscode.window.showQuickPick(files);
}

function getOctoOptions(): Octo.OctoOptions {
    var config = vscode.workspace.getConfiguration('octo');
    var color = config.get('color');
    var options: Octo.OctoOptions = Octo.GetTheme(<Octo.OctoColor>color);
    options.clipQuirks = config.get('clipQuirks', false);
    options.jumpQuirks = config.get('jumpQuirks', false);
    options.shiftQuirks = config.get('shiftQuirks', false);
    options.enableXO = config.get('enableX0', false);
    options.screenRotation = config.get('screenRotation', 0);
    options.tickrate = config.get('tickrate', 20);

    return options;
}

interface IRenderer {
    render(text: string) : string;
}

class OctoDocumentContentProvider implements TextDocumentContentProvider {
    private _context: ExtensionContext;
    private _onDidChange = new EventEmitter<Uri>();
    private _waiting : boolean;
    private _renderer : IRenderer;

    constructor() {
        this._waiting = false;
    }

    public provideTextDocumentContent(uri: Uri): Thenable<string> {
        return vscode.workspace.openTextDocument(Uri.parse(uri.query).with({scheme: 'file'})).then(sourceDocument => {
            return sourceDocument.getText();
        }).then(source => {
            return vscode.workspace.openTextDocument(getOctoPath('index.html'))
            .then(document => {
                var options = getOctoOptions();
                var text = document.getText().replace(/(css\/|images\/|js\/)/g, `${getOctoPath()}/$1`);
                text = text.replace('{{SOURCE}}', source);
                text = text.replace('{{OPTIONS}}', JSON.stringify(options));
                // fs.writeFile(getOctoPath('test_output.html'), text);
                return text;
            });
        });
    }

    get onDidChange(): Event<Uri> {
        return this._onDidChange.event;
    }

    public update(uri: Uri) {
        if (!this._waiting) {
            this._waiting = true;
            setTimeout(() => {
                this._waiting = false;
                this._onDidChange.fire(uri);
            }, 300);
        }
    }
}