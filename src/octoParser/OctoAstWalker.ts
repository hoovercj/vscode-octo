import { Node, NodeType, Program, Statement, Expression, IfStatement,
    LoopStatement, WhileStatement, Value, ComparisonOperator,
    Location, Position } from './OctoAst';

// Included in this architecture:
//  Symbol provider - aliases/consts/labels[name]: location
//  Go to definition - aliases/consts/labels[name]: location
//  Find all references - usages[name]: [location]
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
        // TODO;
    }

    private handleIfBranch(node: Statement | String) {
        if (typeof(node) == 'string') {
            this.handleReturnKeyword;
        }

        this.walkStatement(<Statement>node);
    }

    private handleKeywordExpression(node: Expression) {
        // TODO
    }

    private handleUnaryExpression(node: Expression) {
        let value = node.one; 
        switch (value.type) {
            case "vRegister":
                
                break;
            case "Label":
                // if (this.IsVRegister(value)) {
                //     this.AddUsage(value.value, value.location);
                // }
                if (Object.keys(this.constants).indexOf(value.value)) {
                    this.AddUsage(value.value, node.location);
                }
                break;
            case "Number":
                break;
            default:
                break;
        }
        // TODO
    }

    private handleRandomExpression(node: Expression): void {
        let value = node.one; 
        if (Object.keys(this.constants).indexOf(value)) {
            this.AddUsage(value, node.location);
        }

        // TODO
    }

    private handleAddressExpression(node: Expression): void {
        if (this.ParseNumber(node.one.value) == null) {
            this.AddUsage(node.one.value, node.location);
        }
    }

    private handleDeclaration(node: Expression): void {
        let declaration = <Declaration>{ value: node.two.value, location: node.location };
        this.AddUsage(node.one.value, node.one.location);

        switch (node.op) {
            case ":const":
                this.constants[node.one.value] = declaration;
                break;
            case ":alias":
                this.aliases[node.one.value] = declaration;
                break;
            case ":":
                this.labels[node.one.value] = declaration;
                if (Array.isArray(node.two)) {
                    node.two.forEach(s => {
                        this.walkStatement(s);
                    });
                }
                // TODO: what to do?
                break;
            default:
                throw "Unknown declaration type";
        }
    }

    private handleAssignmentExpression(node: Expression) {
        // TODO
        this.AddUsage(node.one.value, node.location);
        if (this.IsVRegister(node.one)) {

        } else if (node.one.type == "iRegister") {
            
        } else if (node.one == "buzzer" || node.one == "delay") {

        }
    }

    private handleReturnKeyword() {
        // TODO
    }

    private IsVRegister(value: any): boolean {
        if (typeof(value) == "object") { return value.type == "vRegister" };

        if (typeof(value) == "string") {
            // Explicit v-register
            if (V_REGISTERS.indexOf(value.toLowerCase()) >= 0) { return true; }
            // Aliased v-register
            if (Object.keys(this.aliases).indexOf(value) >= 0) { return true; }
        }
        return false;
    }

    private IsIRegister(value: string): boolean {
        return value == 'i';
    }

    private handleTestExpression(node: Expression): void {
        switch (node.op) {
            case "-key":
            case "key":
                break;
            default:
                break;
        }
    }

    // TODO: this is broken. The id being passed in is an object
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
