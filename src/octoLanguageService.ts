'use strict'

import * as vscode from 'vscode';
var parser = require('./octoParser/parser.js');
import { OctoAstWalker, Declaration } from './octoParser/OctoAstWalker';
import * as OctoAst from './octoParser/OctoAst';

interface LanguageServiceInfo {
    uri: vscode.Uri
    walker: OctoAstWalker;
    lastValidTree: OctoAst.Program;
    error: any;
    symbols: vscode.SymbolInformation[]
}

export default class OctoLanguageService implements vscode.DocumentSymbolProvider, vscode.DefinitionProvider {
    private context: vscode.ExtensionContext;

    private documentInfo: {[uri:string]:LanguageServiceInfo} = {};

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public register() {
        let symbolDefinitionRegistration = vscode.languages.registerDefinitionProvider('octo', this);
        let symbolProviderRegistration = vscode.languages.registerDocumentSymbolProvider('octo', this);
        this.context.subscriptions.push(symbolProviderRegistration, symbolDefinitionRegistration);
    }

    public open(document: vscode.TextDocument): void {
        this.documentInfo[document.uri.toString()] = {
            error: null,
            lastValidTree: null,
            uri: document.uri,
            walker: new OctoAstWalker(),
            symbols: []
        }
        this.update(document);
    }

    public update(document: vscode.TextDocument): void {
        let stringUri = document.uri.toString();
        if (!this.documentInfo[stringUri]) {
            this.documentInfo[stringUri] = {
                error: null,
                lastValidTree: null,
                uri: document.uri,
                walker: new OctoAstWalker(),
                symbols: []
            }
        }
        try {
            let text = document.getText();
            let newTree = parser.parse(text);
            this.documentInfo[stringUri].lastValidTree = newTree;
            this.documentInfo[stringUri].walker.walkProgram(newTree);
            this.buildSymbolsList(document.uri);
            this.documentInfo[stringUri].lastValidTree = newTree;
        } catch (error) {
            this.documentInfo[stringUri].error = error;
            console.error(error);
            console.error(JSON.stringify(error));
        }
    }

    public provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.SymbolInformation[] | Thenable<vscode.SymbolInformation[]> {
        return this.getSymbols(document.uri.toString());
    }

    public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Definition | Thenable<vscode.Definition> {
        console.log('ProvideDefinition');
        let range = document.getWordRangeAtPosition(position);
        let token = document.getText(range);
        
        let symbols = this.getSymbols(document.uri.toString());
        let definition = null;
        symbols.forEach(symbol => {
            if (symbol.name == token) {
                definition = symbol.location;
                return;
            }
        });
        return definition;
    }

    public getSymbols(uri: string) {
        return this.documentInfo[uri].symbols;
    }

    private buildSymbolsList(uri: vscode.Uri) {
        let symbols: vscode.SymbolInformation[] = [];

        let documentInfo = this.documentInfo[uri.toString()];
        let walker = documentInfo.walker;
        
        let aliases = walker.aliases;
        let constants = walker.constants;
        let labels = walker.labels;
        
        let aliasSymbols = this.declarationsToSymbols(uri, aliases, vscode.SymbolKind.Field);
        let constantSymbols = this.declarationsToSymbols(uri, constants, vscode.SymbolKind.Constant);
        let labelSymbols = this.declarationsToSymbols(uri, labels, vscode.SymbolKind.Function);
        
        symbols = symbols.concat(aliasSymbols);
        symbols = symbols.concat(constantSymbols);
        symbols = symbols.concat(labelSymbols);

        this.documentInfo[uri.toString()].symbols = symbols;
    }

    private declarationsToSymbols(uri: vscode.Uri, declarations: {[id:string]: Declaration}, kind: vscode.SymbolKind): vscode.SymbolInformation[] {
        return Object.keys(declarations).map(name => {
            let declaration = declarations[name];
            let location = <vscode.Location> { 
                uri: uri,
                range: { 
                    start: { character: declaration.location.start.column - 1, line: declaration.location.start.line - 1 },
                    end: { character: declaration.location.end.column - 1, line: declaration.location.end.line - 1 }
                }
            };

            return <vscode.SymbolInformation>{ 
                name: name,
                location: location,
                kind: kind,
                containerName: "test"
            };
        });
    }
}