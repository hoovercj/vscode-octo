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

export default class OctoLanguageService implements vscode.DocumentSymbolProvider, vscode.DefinitionProvider, vscode.ReferenceProvider {
    private context: vscode.ExtensionContext;

    private documentInfo: {[uri:string]:LanguageServiceInfo} = {};

    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public register() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection();
        let symbolDefinitionRegistration = vscode.languages.registerDefinitionProvider('octo', this);
        let symbolProviderRegistration = vscode.languages.registerDocumentSymbolProvider('octo', this);
        let referencesProviderRegistration = vscode.languages.registerReferenceProvider('octo', this);

        // Do i need to manually call clear on this.diagnosticCollection?
        this.context.subscriptions.push(this.diagnosticCollection, symbolProviderRegistration, symbolDefinitionRegistration, referencesProviderRegistration);
    }

    public provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.SymbolInformation[] | Thenable<vscode.SymbolInformation[]> {
        return this.getSymbols(document.uri.toString());
    }

    public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Definition | Thenable<vscode.Definition> {
        return this.getSymbolDeclaredAtPosition(document, position);
    }

    public provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): vscode.Location[] | Thenable<vscode.Location[]> {
        let range = document.getWordRangeAtPosition(position);
        let identifier = document.getText(range);

        let stringUri = document.uri.toString();
        let documentInfo = this.documentInfo[stringUri];
        let usages = documentInfo.walker.usages;
        let astLocations = usages[identifier];

        let vscodeLocations = astLocations.map(location => {
            return this.walkerLocationToVscodeLocation(document.uri, location);
        });

        // TODO: filter based on ReferenceContext
        return vscodeLocations;
    }

    private getSymbolDeclaredAtPosition(document: vscode.TextDocument, position: vscode.Position): vscode.Location {
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
        this.diagnosticCollection.set(document.uri, []);
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
            this.buildSymbolsList(document);
            this.documentInfo[stringUri].lastValidTree = newTree;
        } catch (error: { message: string, location: OctoAst.Location }) {
            this.documentInfo[stringUri].error = error;
            // debugger
            let location = this.walkerLocationToVscodeLocation(document.uri, error.location);
            let range = location.range;
            range.end.character = Number.MAX_VALUE;

            let diagnostic = <vscode.Diagnostic> {
                message: error.message,
                range: range,
                source: "Octo Parser",
                severity: vscode.DiagnosticSeverity.Error
            }

            this.diagnosticCollection.set(document.uri, [diagnostic]);
            // console.error(error);
        }
    }

    public getSymbols(uri: string) {
        return this.documentInfo[uri].symbols;
    }

    private buildSymbolsList(document: vscode.TextDocument) {
        let uri = document.uri;
        let stringUri = uri.toString();

        let symbols: vscode.SymbolInformation[] = [];

        let documentInfo = this.documentInfo[stringUri];
        let walker = documentInfo.walker;
        
        let aliases = walker.aliases;
        let constants = walker.constants;
        let labels = walker.labels;
        
        let aliasSymbols = this.declarationsToSymbols(document, aliases, vscode.SymbolKind.Field);
        let constantSymbols = this.declarationsToSymbols(document, constants, vscode.SymbolKind.Constant);
        let labelSymbols = this.declarationsToSymbols(document, labels, vscode.SymbolKind.Function);
        
        symbols = symbols.concat(aliasSymbols);
        symbols = symbols.concat(constantSymbols);
        symbols = symbols.concat(labelSymbols);

        this.documentInfo[stringUri].symbols = symbols;
    }

    private declarationsToSymbols(document: vscode.TextDocument, declarations: {[id:string]: Declaration}, kind: vscode.SymbolKind): vscode.SymbolInformation[] {
        let uri = document.uri;

        return Object.keys(declarations).map(name => {
            let declaration = declarations[name];
            let location = this.walkerLocationToVscodeLocation(uri, declaration.location);

            return <vscode.SymbolInformation>{ 
                name: name,
                location: location,
                kind: kind,
                containerName: document.fileName
            };
        });
    }

    private walkerLocationToVscodeLocation(uri: vscode.Uri, location: OctoAst.Location): vscode.Location {
        return <vscode.Location> { 
            uri: uri,
            range: {
                start: { character: location.start.column - 1, line: location.start.line - 1 },
                end: { character: location.end.column - 1, line: location.end.line - 1 }
            }
        };
    }
}