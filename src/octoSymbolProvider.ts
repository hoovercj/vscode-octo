'use strict'

import * as vscode from 'vscode';

export default class OctoSymbolProvider implements vscode.DocumentSymbolProvider {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public register() {
        let symbolProviderRegistration = vscode.languages.registerDocumentSymbolProvider('octo', this);
        this.context.subscriptions.push(symbolProviderRegistration);
    }

    public provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.SymbolInformation[] | Thenable<vscode.SymbolInformation[]> {
        return this.getSymbols(document);
    }

    private getSymbols(document: vscode.TextDocument): vscode.SymbolInformation[] {
        let aliasRegex = /(.*?):alias[\s+]+([\S]+)[\s+]+([\S]+)/g; //($1)$2 name, $3 value
        let constRegex = /(.*?):const[\s+]+([\S]+)[\s+]+([\S]+)/g; //($1)$2 name, $3 value
        let labelRegex = /(.*?):[\s+]+([\S]+)/g; //($1)$2 name

        let symbols: vscode.SymbolInformation[] = [];
        symbols = symbols.concat(this.executeSymbolsRegex(aliasRegex, document));
        symbols = symbols.concat(this.executeSymbolsRegex(constRegex, document));
        symbols = symbols.concat(this.executeSymbolsRegex(labelRegex, document));
        return symbols;
    }

    private executeSymbolsRegex(regexp: RegExp, document: vscode.TextDocument): vscode.SymbolInformation[] {
        let symbols: vscode.SymbolInformation[] = [];
        let lines = document.getText().split('\n');
        lines.forEach((line: string, index) => {
            let match: RegExpExecArray;
            while ((match = regexp.exec(line)) != null) {
                // Skip comments
                if (match[1].indexOf('#') >= 0) {
                    break;
                }

                let currentSymbol: vscode.SymbolInformation = <vscode.SymbolInformation>{};
                currentSymbol.name = match[2];
                currentSymbol.kind = vscode.SymbolKind.Variable;
                var location: vscode.Location = <vscode.Location>{};
                var range: vscode.Range = <vscode.Range>{};
                let start = match.input.indexOf(currentSymbol.name);
                let end = start + currentSymbol.name.length;
                range.start = <vscode.Position>{ line: index, character: start};
                range.end = <vscode.Position>{ line: index, character: end };
                location.uri = document.uri;
                location.range = range;
                currentSymbol.location = location;
                symbols.push(currentSymbol);
            }
        });
        return symbols;
    }
}