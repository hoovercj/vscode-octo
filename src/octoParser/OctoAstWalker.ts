import { Node, NodeType, Program, Statement, Expression, IfStatement,
    LoopStatement, WhileStatement, Value, ComparisonOperator,
    Location, Position } from './OctoAst';

// Included in this architecture:
//  Symbol provider -- DONE
//  Go to definition -- DONE
//  Find all references -- DONE
// TODO:
//  Diagnostics Provider - if parse or compile error, show diagnostics
//  Hover Provider - what info do I provide???
//  Completion Provider - Parse, get parse error, see what type is needed, suggest based on that
//  - e.g. aliasable suggest v0-F + aliases, etc.
//  Compiler

const V_REGISTERS = [
    "v0",
    "v1",
    "v2",
    "v3",
    "v4",
    "v5",
    "v6",
    "v7",
    "v8",
    "v9",
    "va",
    "vb",
    "vc",
    "vd",
    "ve",
    "vf"
];

export interface Walker {
    walkProgram(node: Program): void;
    walkStatement(node: Statement): void;
    walkExpression(node: Expression): void;
    walkIfStatement(node: IfStatement): void;
    walkLoopStatement(node: LoopStatement): void;
    walkWhileStatement(node: WhileStatement): void;
    walkValue(node: Value): void;
}

export class Declaration {
    value: string | number;
    location: Location;
}

export class OctoAstWalker implements Walker {

    public aliases: { [id: string] : Declaration } = {};
    public constants: { [id: string] : Declaration } = {};
    public labels: { [id: string] : Declaration } = {};
    public usages: { [id: string] : Location[] } = {};

    public walkProgram(node: Program): void {
        this.aliases = {};
        this.constants = {};
        this.labels = {};
        this.usages = {};

        node.body.forEach(s => {
            this.walkStatement(s);
        });
    }

    walkStatement(node: Statement): void {
        switch (node.type) {
            case NodeType.IfStatement:
                this.walkIfStatement(<IfStatement>node);
                break;
            case NodeType.LoopStatement:
                this.walkLoopStatement(<LoopStatement>node);
                break;
            case NodeType.WhileStatement:
                this.walkLoopStatement(<WhileStatement>node);
                break;
            case NodeType.Declaration:
            case NodeType.TestExpression:
            case NodeType.AssignmentExpression:
            case NodeType.RandomExpression:
            case NodeType.AddressExpression:
            case NodeType.KeywordExpression:
            case NodeType.UnaryExpression:
            case NodeType.Directive:
                this.walkExpression(<Expression>node)
                break;
            default:
                this.walkValue(<Value>node);
                break;
        }
    }

    walkExpression(node: Expression): void {
        switch (node.type) {
            case NodeType.Declaration:
                this.handleDeclaration(node);
                break;
            case NodeType.TestExpression:
                this.handleTestExpression(node);
                break;
            case NodeType.AssignmentExpression:
                this.handleAssignmentExpression(node);
                break;
            case NodeType.RandomExpression:
                this.handleRandomExpression(node);
                break;
            case NodeType.AddressExpression:
                this.handleAddressExpression(node);
                break;
            case NodeType.KeywordExpression:
                this.handleKeywordExpression(node);
                break;
            case NodeType.UnaryExpression:
                this.handleUnaryExpression(node);
                break;
            case NodeType.Directive:
                this.handleDirective(node);
            default:
                break;
        }
    }

    walkIfStatement(node: IfStatement): void { 
        this.handleTestExpression(node.test);
        this.handleIfBranch(node.consequent);
        if (node.alternate) {
            this.handleIfBranch(node.alternate);
        }
    }

    // seems a lot like handleIfBranch
    walkLoopStatement(node: LoopStatement): void {
        if (Array.isArray(node.body)) {
            node.body.forEach(statement => {
                if (typeof(statement) == 'string') {
                    this.handleReturnKeyword;
                }
                this.walkStatement(statement);
            });
        }
    }

    walkWhileStatement(node: WhileStatement): void { 
        this.handleTestExpression(node.test);
    }

    walkValue(node: Value): void {
        if (node && node.type && node.type == "Trivia") { return; }
        this.AddUsageForNode(node);
    }

    private handleIfBranch(node: Statement | String) {
        if (typeof(node) == 'string') {
            this.handleReturnKeyword;
        } else if (Array.isArray(node)) {
            node.forEach(s => this.walkStatement(s));
        } else {
            this.walkStatement(<Statement>node);
        }
    }

    private handleKeywordExpression(node: Expression) {

    }

    private handleDirective(node: Expression) {
        this.AddUsageForNode(node);
    }

    private handleUnaryExpression(node: Expression) {
        let value = node.one; 
        switch (value.type) {
            case "vRegister":
            case "Label":
                this.AddUsageForNode(value);
                break;
            case "Number":
                break;
            default:
                break;
        }
        // TODO
    }

    private handleRandomExpression(node: Expression): void {
        this.AddUsageForNode(node);
    }

    private handleAddressExpression(node: Expression): void {
        this.AddUsageForNode(node);
    }

    private handleDeclaration(node: Expression): void {
        let name = node.one;
        this.AddUsageForNode(name);
        let declaration = <Declaration>{ value: name.value, location: name.location };

        switch (node.op) {
            case ":const":
                this.constants[name.value] = declaration;
                break;
            case ":alias":
                this.aliases[name.value] = declaration;
                break;
            case ":":
                this.labels[name.value] = declaration;
                let value = node.two;
                if (Array.isArray(value)) {
                    value.forEach(s => {
                        this.walkStatement(s);
                    });
                }
                break;
            default:
                throw "Unknown declaration type";
        }
    }

    private handleAssignmentExpression(node: Expression) {
        let left = node.one;
        let right = node.two;
        this.AddUsageForNode(left);
        this.AddUsageForNode(right);
        if (this.IsVRegister(left)) {

        } else if (this.IsIRegister(left)) {
            
        } else if (left.type == "buzzer" || left.type == "delay") {

        }
    }

    private handleReturnKeyword() {

    }

    private IsAlias(value: any): boolean {
        if (typeof(value) == "object" && value.type != 'Label') { return false; };

        if (typeof(value) == "string") {
            if (Object.keys(this.aliases).indexOf(value) >= 0) { return true; }
        }
        return false;
    }

    private IsConstant(value: any): boolean {
        if (typeof(value) == "object" && value.type != 'Label') { return false; };

        if (typeof(value) == "string") {
            if (Object.keys(this.constants).indexOf(value) >= 0) { return true; }
        }
        return false;
    }

    private IsVRegister(value: any): boolean {
        if (typeof(value) == "object") { return value.type == "vRegister" };

        if (typeof(value) == "string") {
            // Explicit v-register
            if (V_REGISTERS.indexOf(value.toLowerCase()) >= 0) { return true; }
            // Aliased v-register
            if (this.IsAlias(value)) { return true; }
        }
        return false;
    }

    private IsIRegister(value: any): boolean {
        if (typeof(value) == "object") { return value.type == "vRegister" };

        return value == 'i';
    }

    private handleTestExpression(node: Expression): void {
        this.AddUsageForNode(node);
        switch (node.op) {
            case "-key":
            case "key":
                break;
            default:
                break;
        }
    }

    private AddUsageForNode(node) {
        if (!node) { return; }

        if (node.value && node.location) {
            this.AddUsage(node.value, node.location);
            return;
        }

        if (node.one) {
            this.AddUsageForNode(node.one);
        }

        if (node.two) {
            this.AddUsageForNode(node.two);
        }

        if (node.three) {
            this.AddUsageForNode(node.three);
        }
    }

    private AddUsage(id: string, loc: Location): void {
        let nodeUsages: Location[] = this.usages[id] || [];
        nodeUsages.push(loc);
        this.usages[id] = nodeUsages;
    }

    private ParseNumber(value: string) {
        try {
            if (value.indexOf('0b') == 0) {
                return parseInt(value.replace('0b', ''), 2);
            } else {
                return parseInt(value);
            }
        } catch(error) {
            return null;
        }
    }
}
