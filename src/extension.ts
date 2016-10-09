'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionContext, TextDocumentContentProvider, EventEmitter, Event, Uri, ViewColumn } from 'vscode';
import * as fs from 'fs';

export function activate(context: ExtensionContext) {

    let provider = new OctoDocumentContentProvider(context);
    let registration = vscode.workspace.registerTextDocumentContentProvider('octo', provider);

    let d1 = vscode.commands.registerCommand('octo.showPreview', showPreview);
    let d2 = vscode.commands.registerCommand('octo.showPreviewToSide', uri => showPreview(uri, true));
    let d3 = vscode.commands.registerCommand('octo.showSource', showSource);

    context.subscriptions.push(d1, d2, d3, registration);

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
    return uri.with({ scheme: 'octo', path: uri.path + '.compiled', query: uri.toString() });
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

    return vscode.workspace.openTextDocument(docUri).then(doc => {
        return vscode.window.showTextDocument(doc);
    });
}

interface IRenderer {
    render(text: string) : string;
}

class OctoDocumentContentProvider implements TextDocumentContentProvider {
    private _context: ExtensionContext;
    private _onDidChange = new EventEmitter<Uri>();
    private _waiting : boolean;
    private _renderer : IRenderer;

    constructor(context: ExtensionContext) {
        this._context = context;
        this._waiting = false;
    }

    private getOctoPath(file?: string) {
        return this._context.asAbsolutePath(path.join('octo', file || ''));
    }

    public provideTextDocumentContent(uri: Uri): Thenable<string> {

        return vscode.workspace.openTextDocument(Uri.parse(uri.query)).then(sourceDocument => {
            return sourceDocument.getText();
        }).then(source => {
            return vscode.workspace.openTextDocument(this.getOctoPath('index.html'))
            .then(document => {
                var text = document.getText().replace(/(css\/|images\/|js\/)/g, `${this.getOctoPath()}/$1`);
                text = text.replace('{{SOURCE}}', source);
                // fs.writeFile(this.getOctoPath('test_output.html'), text);
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