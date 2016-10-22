'use strict'

import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as Octo from './octo';

interface IRenderer {
    render(text: string) : string;
}

export default class OctoTools implements vscode.TextDocumentContentProvider {
    private static onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private static waiting : boolean;
    private static renderer : IRenderer;
    private static context : vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        OctoTools.waiting = false;
        OctoTools.context = context;
    }

    public register() {
        let documentContentProviderRegistration = vscode.workspace.registerTextDocumentContentProvider('octo', this);
        let d1 = vscode.commands.registerCommand('octo.showTools', OctoTools.showTools);
        let d2 = vscode.commands.registerCommand('octo.showToolsToSide', uri => OctoTools.showTools(uri, true));
        let d3 = vscode.commands.registerCommand('octo.showSource', OctoTools.showSource);
        let d4 = vscode.commands.registerCommand('octo.openDocs', OctoTools.openDoc);
        let d5 = vscode.commands.registerCommand('octo.openExample', OctoTools.openExample);
        let d6 = vscode.commands.registerCommand('octo.decompile', OctoTools.decompileSelection);
        OctoTools.context.subscriptions.push(d1, d2, d3, d4, d5, d6, documentContentProviderRegistration);
    }

    public provideTextDocumentContent(uri: vscode.Uri): Thenable<string> {
        return vscode.workspace.openTextDocument(vscode.Uri.parse(uri.query).with({scheme: 'file'})).then(sourceDocument => {
            return sourceDocument.getText();
        }).then(source => {
            return OctoTools.openOctoTools(source);
        });
    }

    public static openOctoTools(source: string) {
        return vscode.workspace.openTextDocument(OctoTools.getOctoPath('index.html'))
            .then(document => {
                var options = OctoTools.getOctoOptions();
                var text = document.getText().replace(/(css\/|images\/|js\/)/g, `${OctoTools.getOctoPath()}/$1`);
                text = text.replace('{{SOURCE}}', source);
                text = text.replace('{{OPTIONS}}', JSON.stringify(options));
                return text;
            });
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
        return OctoTools.onDidChange.event;
    }

    public static update(uri: vscode.Uri) {
        if (!OctoTools.waiting) {
            OctoTools.waiting = true;
            setTimeout(() => {
                OctoTools.waiting = false;
                OctoTools.onDidChange.fire(uri);
            }, 300);
        }
    }

    public static showTools(uri?: vscode.Uri, sideBySide: boolean = false) {

        let resource = uri;
        if (!(resource instanceof vscode.Uri)) {
            if (vscode.window.activeTextEditor) {
                // we are relaxed and don't check for octo files
                resource = vscode.window.activeTextEditor.document.uri;
            }
        }

        if (!(resource instanceof vscode.Uri)) {
            if (!vscode.window.activeTextEditor) {
                // OctoTools is most likely toggling the preview
                return vscode.commands.executeCommand('octo.showSource');
            }
            // nothing found that could be shown or toggled
            return;
        }
        let thenable = vscode.commands.executeCommand('vscode.previewHtml',
            Octo.getOctoUri(resource),
            OctoTools.getViewColumn(sideBySide),
            `Octo: '${path.basename(resource.fsPath)}'`);

        return thenable;
    }

    public static showSource(mdUri: vscode.Uri) {
        if (!mdUri) {
            return vscode.commands.executeCommand('workbench.action.navigateBack');
        }

        const docUri = vscode.Uri.parse(mdUri.query);
        for (let editor of vscode.window.visibleTextEditors) {
            if (editor.document.uri.toString() === docUri.toString()) {
                return vscode.window.showTextDocument(editor.document, editor.viewColumn);
            }
        }

        return vscode.workspace.openTextDocument(docUri).then(doc => vscode.window.showTextDocument(doc));
    }

    public static openDoc(): void {
        var dir = path.join('docs', '_site');
        var doc = OctoTools.showQuickPickForDir(dir);
        var selectedFilename;
        if (doc) {
            doc.then(filename => {
                selectedFilename = filename.split('.')[0];
                return vscode.workspace.openTextDocument(Octo.getFileUri(OctoTools.getOctoPath(path.join(dir, filename))))
            }).then(document => vscode.commands.executeCommand('vscode.previewHtml',
                document.uri,
                OctoTools.getViewColumn(true),
                `Octo Docs: ${selectedFilename}`));
        }
    }

    public static openExample(): void {
        var dir = 'examples';
        var promise = OctoTools.showQuickPickForDir(dir);
        var selectedFilename;

        if (!promise) return;

        promise.then(filename => {
            if (!filename) return;
            selectedFilename = filename.split('.')[0];
            return vscode.workspace.openTextDocument(Octo.getFileUri(OctoTools.getOctoPath(path.join(dir, filename))))
        }).then(document => vscode.window.showTextDocument(document));
    }

    public static showQuickPickForDir(dir): Thenable<string> {
        var files = fs.readdirSync(OctoTools.getOctoPath(dir));
        if (!files) return;

        return vscode.window.showQuickPick(files);
    }

    private static getOctoOptions(): Octo.OctoOptions {
        var config = vscode.workspace.getConfiguration('octo');
        var color = config.get('color');
        var options: Octo.OctoOptions = Octo.GetTheme(<Octo.OctoColor>color);
        options.shiftQuirks = config.get('shiftQuirks', false);
        options.loadStoreQuirks = config.get('loadStoreQuirks', false);
        options.vfOrderQuirks = config.get('vfOrderQuirks', false);
        options.clipQuirks = config.get('clipQuirks', false);
        options.jumpQuirks = config.get('jumpQuirks', false);
        options.enableXO = config.get('enableX0', false);
        options.tickrate = config.get('tickrate', 20);
        options.screenRotation = config.get('screenRotation', 0);
        options.numericFormat = config.get('numericFormat', 'hex');
        options.numericMask = config.get('numericMask', false);

        return options;
    }

    public static decompileSelection(): void {
        OctoTools.decompileFile(vscode.window.activeTextEditor.document.uri.fsPath, OctoTools.replaceSelection);
    }

    private static decompileFile(path: string, callback): void {
        let options = OctoTools.getOctoOptions();
        let flags = "";
        flags += `--${options.numericFormat}`;
        flags += options.shiftQuirks ? ' --qshift' : '';
        flags += options.loadStoreQuirks ? ' --qloadstore' : '';
        flags += options.vfOrderQuirks ? ' --qvforder' : '';
        flags += options.numericMask ? ' --numMask' : '';

        let octoPath = OctoTools.getOctoPath('octo');
        let command = `node ${octoPath} --decompile ${flags} ${path}`;
        cp.exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(error);
            }

            if (stderr) {
                console.error(stderr.toString());
            }

            if (stdout) {
                callback(stdout.toString());
            }
        });
    }

    private static replaceSelection(newText: string): void {
        let activeEditor = vscode.window.activeTextEditor;
        let selection: vscode.Selection | vscode.Range = activeEditor.selection;
        if (selection.isEmpty) {
            let lineCount = activeEditor.document.lineCount;
            let startPosition = new vscode.Position(0, 0);
            let endPosition = new vscode.Position(lineCount,0);
            selection = new vscode.Range(startPosition, endPosition);
        }
        activeEditor.edit(editBuilder => {
            editBuilder.replace(selection, newText);
        });
    }

    private static getViewColumn(sideBySide): vscode.ViewColumn {
        const active = vscode.window.activeTextEditor;
        if (!active) {
            return vscode.ViewColumn.One;
        }

        if (!sideBySide) {
            return active.viewColumn;
        }

        switch (active.viewColumn) {
            case vscode.ViewColumn.One:
                return vscode.ViewColumn.Two;
            case vscode.ViewColumn.Two:
                return vscode.ViewColumn.Three;
        }

        return active.viewColumn;
    }

    private static isOctoFile(document: vscode.TextDocument) {
        return document.languageId === 'octo'
            && document.uri.scheme !== 'octo'; // prevent processing of own documents
    }

    private static getOctoPath(file?: string) {
        return OctoTools.context.asAbsolutePath(path.join('octo', file || ''));
    }
}