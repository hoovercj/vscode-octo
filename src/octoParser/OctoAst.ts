export interface Node {
    type: string;
    location: Location; //SourceLocation | null;
}

export class NodeType {
    public static Declaration = "Declaration";
    public static IfStatement = "IfStatement";
    public static LoopStatement = "LoopStatement";
    public static WhileStatement = "WhileStatement";
    public static TestExpression = "TestExpression";
    public static AssignmentExpression = "AssignmentExpression";
    public static RandomExpression = "RandomExpression";
    public static AddressExpression = "AddressExpression";
    public static KeywordExpression = "KeywordExpression";
    public static UnaryExpression = "UnaryExpression";
    public static Directive = "Directive";
    public static vRegister = "vRegister";
    public static iRegister = "iRegister";
    public static Label = "Label";
    public static Trivia = "Trivia"
}

export interface Program extends Node {
    body: Statement[];
}

export interface Statement extends Node {
    // Intentionally empty
}

export interface Expression extends Statement {
    op: any;
    one: any;
    two?: any;
    three?: any;
}

export interface IfStatement extends Statement {
    test: Expression;
    consequent?: Statement | string;
    alternate?: Statement | string;
}

export interface LoopStatement extends Statement {
    body?: any[];
}

export interface WhileStatement extends Statement {
    test: Expression;
}

export interface Value extends Statement {
    value: string;
}

export enum ComparisonOperator {
    "==",
    "!=",
    "<",
    ">",
    "<=",
    ">=",
    "key",
    "-key"
}

export interface Location {
    // source: string | null;
    start: Position;
    end: Position;
}

export interface Position {
    line: number;
    column: number;
}