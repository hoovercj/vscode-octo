// "use strict";

// import * as vscode from 'vscode';

// ////////////////////////////////////
// //
// //   Tokenization:
// //
// ////////////////////////////////////

// interface Token {
//     symbol: string;
//     line: number;
//     charStart: number;
//     charEnd: number;
// }

// function parse(token) {
//     var num = parseNumber(token);
//     return isNaN(num) ? token : num;
// }

// function parseNumber(token) {

//     // Check if this token is a valid binary number
//     if (/^[+\-]?0b[01]+$/.test(token)) {

//         var bitstring;
//         var isNegative = (token.indexOf('-') == 0);

//         // Check for any leading +/- sign character
//         if (isNegative || (token.indexOf('+') == 0)) {
//             // Remove sign character and 0b- prefix
//             bitstring = token.slice(3);
//         } else {
//             // Remove 0b- prefix
//             bitstring = token.slice(2);
//         }

//         var value = parseInt(bitstring, 2);
//         return (isNegative) ? -value : value;
//     }

//     // Check if this token is a valid hexadecimal number
//     if (/^[+\-]?0x[0-9a-f]+$/i.test(token)) {
//         return parseInt(token, 16);
//     }

//     // Check if this token is a valid decimal number
//     if (/^[+\-]?[0-9]+$/.test(token)) {
//         return parseInt(token, 10);
//     }

//     return NaN;
// }

// function tokenize(text) {
//     var ret = [];
//     var index = 0;
//     var token = "";
//     var tokenStart = -1;
//     var line = 0;
//     // TODO: add line number to this and hopefully range information
//     while (index < text.length) {
//         var c = text.charAt(index++);
//         if (c == '#') {
//             if (token.length > 0) {
//                 ret.push([parse(token), tokenStart, index, line]);
//                 tokenStart = -1;
//             }
//             token = "";
//             while (c != '\n' && index < text.length) {
//                 c = text.charAt(index++);
//             }
//         }
//         else if (" \t\n\r\v".indexOf(c) >= 0) {
//             if (token.length > 0) {
//                 ret.push([parse(token), tokenStart, index, line]);
//                 tokenStart = -1;
//             }
//             if (c == '\n') {
//                 line++;
//             }
//             token = "";
//         }
//         else {
//             if (tokenStart == -1) { tokenStart = index; }
//             token += c;
//         }
//     }
//     if (token.length > 0) {
//         ret.push([parse(token), tokenStart, index + 1, line]);
//     }
//     return ret;
// }

// ////////////////////////////////////
// //
// //   The Octo Compiler:
// //
// ////////////////////////////////////

// class DebugInfo {
//     private lines: string;
//     private locs: {[key: string]: string};

//     constructor(source) {
//         this.lines = source.split('\n');
//         this.locs = {};

//     }
    
//     public posToLine = function (pos) {
//         var i;
//         for (i = 0; i < this.lines.length; i++) {
//             pos -= this.lines[i].length + 1;
//             if (pos <= 0)
//                 break;
//         }
//         return i;
//     }

//     public mapAddr = function (addr, pos) {
//         this.locs[addr] = this.posToLine(pos);
//     }
// }

// enum OctoKind {
//     alias,
//     label,
//     constant
// }

// interface SymbolInfo {
//     range: vscode.Range;
//     kind: OctoKind,
//     value: string
// }

// // function Compiler(source) {
// export class Compiler {
//     private rom = []; // list<int>
//     private loops = []; // stack<[addr, marker]>
//     private branches = []; // stack<[addr, marker, type]>
//     private whiles = []; // stack<int>
//     public dict = {}; // map<name, addr>
//     private protos = {}; // map<name, list<addr>>
//     private longproto = {}; // set<name, true>
//     public aliases = {}; // map<name, registernum>
//     public constants = {}; // map<name, token>
//     private hasmain = true;
//     private schip = false;
//     private xo = false;
//     private breakpoints = {}; // map<address, name>
//     private hereaddr = 0x200;

//     private dbginfo: DebugInfo;
//     private tokens: string[];

//     private symbols: {[key: string]: SymbolInfo } = {};

//     private pos = null;
//     private source: string;
//     constructor(source: string) {
//         this.dbginfo = new DebugInfo(source);
//         this.tokens = tokenize(source);
//         this.source = source;
//     }

//     private data = function (a) {
//         if (typeof this.rom[this.hereaddr - 0x200] != "undefined") {
//             throw "Data overlap. Address " + hexFormat(this.hereaddr) + " has already been defined.";
//         }
//         this.rom[this.hereaddr - 0x200] = (a & 0xFF);
//         if (this.pos) this.dbginfo.mapAddr(this.hereaddr, this.pos[1]);
//         this.hereaddr++;
//     }
    
//     private next = function () { 
//         this.pos = this.tokens[0]; 
//         this.tokens.splice(0, 1); 
//         return this.pos[0]; 
//     }
//     private peek = function () { return this.tokens[0][0]; }
//     private here = function () { return this.hereaddr; }
//     private inst = function (a, b) { this.data(a); this.data(b); }

//     private immediate = function (op, nnn) {
//         this.inst(op | ((nnn >> 8) & 0xF), (nnn & 0xFF));
//     }

//     private fourop = function (op, x, y, n) {
//         this.inst((op << 4) | x, (y << 4) | (n & 0xF));
//     }

//     private jump = function (addr, dest) {
//         this.rom[addr - 0x200] = (0x10 | ((dest >> 8) & 0xF));
//         this.rom[addr - 0x1FF] = (dest & 0xFF);
//     }

//     private isRegister = function (name) {
//         if (!name && (name != 0)) { name = this.peek(); }
//         if (typeof name != "string") { return false; }
//         if (name in this.aliases) { return true; }
//         name = name.toUpperCase();
//         if (name.length != 2) { return false; }
//         if (name[0] != 'V') { return false; }
//         return "0123456789ABCDEF".indexOf(name[1]) >= 0;
//     }

//     private register = function (name) {
//         if (!name) { name = this.next(); }
//         if (!this.isRegister(name)) {
//             throw "Expected register, got '" + name + "'";
//         }
//         if (name in this.aliases) {
//             return this.aliases[name];
//         }
//         name = name.toUpperCase();
//         return "0123456789ABCDEF".indexOf(name[1]);
//     }

//     private expect = function (token) {
//         var thing = this.next();
//         if (thing != token) { throw "Expected '" + token + "', got '" + thing + "'!"; }
//     }

//     private constantValue = function () {
//         var number = this.next();
//         if (typeof number != "number") {
//             if (number in this.protos) {
//                 throw "Constants cannot refer to the address of a forward declaration.";
//             }
//             else if (number in this.dict) {
//                 number = this.dict[number];
//             }
//             else if (number in this.constants) {
//                 number = this.constants[number];
//             }
//             else { throw "Undefined name '" + number + "'."; }
//         }
//         return number;
//     }

//     private reservedNames = {
//         ":=": true, "|=": true, "&=": true, "^=": true, "-=": true, "=-": true, "+=": true,
//         ">>=": true, "<<=": true, "==": true, "!=": true, "<": true, ">": true,
//         "<=": true, ">=": true, "key": true, "-key": true, "hex": true, "bighex": true,
//         "random": true, "delay": true, ":": true, ":next": true, ":unpack": true,
//         ":breakpoint": true, ":proto": true, ":alias": true, ":const": true,
//         ":org": true, ";": true, "return": true, "clear": true, "bcd": true,
//         "save": true, "load": true, "buzzer": true, "if": true, "then": true,
//         "begin": true, "else": true, "end": true, "jump": true, "jump0": true,
//         "native": true, "sprite": true, "loop": true, "while": true, "again": true,
//         "scroll-down": true, "scroll-right": true, "scroll-left": true,
//         "lores": true, "hires": true, "loadflags": true, "saveflags": true, "i": true,
//         "audio": true, "plane": true, "scroll-up": true
//     };

//     private checkName = function (name, kind) {
//         if (name in this.reservedNames) {
//             throw "The name '" + name + "' is reserved and cannot be used for a " + kind + ".";
//         }
//         return name;
//     }

//     private veryWideValue = function () {
//         // i := long NNNN
//         var nnnn = this.next();
//         if (typeof nnnn != "number") {
//             if (nnnn in this.constants) {
//                 nnnn = this.constants[nnnn];
//             }
//             else if (nnnn in this.protos) {
//                 this.protos[nnnn].push(this.here() + 2);
//                 this.longproto[this.here() + 2] = true;
//                 nnnn = 0;
//             }
//             else if (nnnn in this.dict) {
//                 nnnn = this.dict[nnnn];
//             }
//             else {
//                 this.protos[this.checkName(nnnn, "label")] = [this.here() + 2];
//                 this.longproto[this.here() + 2] = true;
//                 nnnn = 0;
//             }
//         }
//         if ((typeof nnnn != "number") || (nnnn < 0) || (nnnn > 0xFFFF)) {
//             throw "Value '" + nnnn + "' cannot fit in 16 bits!";
//         }
//         return (nnnn & 0xFFFF);
//     }

//     private wideValue = function (nnn: string | number) {
//         // can be forward references.
//         // call, jump, jump0, i:=
//         if (!nnn && (nnn != 0)) { nnn = this.next(); }
//         if (typeof nnn != "number") {
//             if (nnn in this.constants) {
//                 nnn = this.constants[nnn];
//             }
//             else if (nnn in this.protos) {
//                 this.protos[nnn].push(this.here());
//                 nnn = 0;
//             }
//             else if (nnn in this.dict) {
//                 nnn = this.dict[nnn];
//             }
//             else {
//                 this.protos[this.checkName(nnn, "label")] = [this.here()];
//                 nnn = 0;
//             }
//         }
//         if ((typeof nnn != "number") || (nnn < 0) || (nnn > 0xFFF)) {
//             throw "Value '" + nnn + "' cannot fit in 12 bits!";
//         }
//         return (nnn & 0xFFF);
//     }

//     private shortValue = function (nn) {
//         // vx:=, vx+=, vx==, v!=, random
//         if (!nn && (nn != 0)) { nn = this.next(); }
//         if (typeof nn != "number") {
//             if (nn in this.constants) { nn = this.constants[nn]; }
//             else { throw "Undefined name '" + nn + "'."; }
//         }
//         // silently trim negative numbers, but warn
//         // about positive numbers which are too large:
//         if ((typeof nn != "number") || (nn < -128) || (nn > 255)) {
//             throw "Argument '" + nn + "' does not fit in a byte- must be in range [-128, 255].";
//         }
//         return (nn & 0xFF);
//     }

//     private tinyValue = function () {
//         // sprite length, unpack high nybble
//         var n = this.next();
//         if (typeof n != "number") {
//             if (n in this.constants) { n = this.constants[n]; }
//             else { throw "Undefined name '" + n + "'."; }
//         }
//         if ((typeof n != "number") || (n < 0) || (n > 15)) {
//             throw "Invalid argument '" + n + "'; must be in range [0,15].";
//         }
//         return (n & 0xF);
//     }

//     private conditional = function (negated) {
//         var reg = this.register();
//         var token = this.next();
//         var compTemp = this.aliases["compare-temp"];
//         if (negated) {
//             if (token == "==") { token = "!="; }
//             else if (token == "!=") { token = "=="; }
//             else if (token == "key") { token = "-key"; }
//             else if (token == "-key") { token = "key"; }
//             else if (token == "<") { token = ">="; }
//             else if (token == ">") { token = "<="; }
//             else if (token == ">=") { token = "<"; }
//             else if (token == "<=") { token = ">"; }
//         }
//         if (token == "==") {
//             if (this.isRegister()) { this.inst(0x90 | reg, this.register() << 4); }
//             else { this.inst(0x40 | reg, this.shortValue()); }
//         }
//         else if (token == "!=") {
//             if (this.isRegister()) { this.inst(0x50 | reg, this.register() << 4); }
//             else { this.inst(0x30 | reg, this.shortValue()); }
//         }
//         else if (token == "key") {
//             this.inst(0xE0 | reg, 0xA1);
//         }
//         else if (token == "-key") {
//             this.inst(0xE0 | reg, 0x9E);
//         }
//         else if (token == ">") {
//             if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
//             else { this.inst(0x60 | compTemp, this.shortValue()); }
//             this.fourop(0x8, compTemp, reg, 0x5); // ve -= v1
//             this.inst(0x3F, 1);                   // if vf == 1 then ...
//         }
//         else if (token == "<") {
//             if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
//             else { this.inst(0x60 | compTemp, this.shortValue()); }
//             this.fourop(0x8, compTemp, reg, 0x7); // ve =- v1
//             this.inst(0x3F, 1);                   // if vf == 1 then ...
//         }
//         else if (token == ">=") {
//             if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
//             else { this.inst(0x60 | compTemp, this.shortValue()); }
//             this.fourop(0x8, compTemp, reg, 0x7); // ve =- v1
//             this.inst(0x4F, 1);                   // if vf != 1 then ...
//         }
//         else if (token == "<=") {
//             if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
//             else { this.inst(0x60 | compTemp, this.shortValue()); }
//             this.fourop(0x8, compTemp, reg, 0x5); // ve -= v1
//             this.inst(0x4F, 1);                   // if vf != 1 then ...
//         }
//         else {
//             throw "Conditional flag expected, got '" + token + "!";
//         }
//     }

//     private controlToken = function () {
//         // ignore a condition
//         var op = this.tokens[1][0];
//         var index = 3;
//         if (op == "key" || op == "-key") { index = 2; }
//         if (index >= this.tokens.length) { index = this.tokens.length - 1; }
//         return this.tokens[index];
//     }

//     private iassign = function (token) {
//         if (token == ":=") {
//             var o = this.next();
//             if (o == "hex") { this.inst(0xF0 | this.register(), 0x29); }
//             else if (o == "bighex") {
//                 this.schip = true;
//                 this.inst(0xF0 | this.register(), 0x30);
//             }
//             else if (o == "long") {
//                 this.xo = true;
//                 var addr = this.veryWideValue();
//                 this.inst(0xF0, 0x00);
//                 this.inst((addr >> 8) & 0xFF, addr & 0xFF);
//             }
//             else { this.immediate(0xA0, this.wideValue(o)); }
//         }
//         else if (token == "+=") {
//             this.inst(0xF0 | this.register(), 0x1E);
//         }
//         else {
//             throw "The operator '" + token + "' cannot target the i register.";
//         }
//     }

//     private vassign = function (reg, token) {
//         if (token == ":=") {
//             var o = this.next();
//             if (this.isRegister(o)) { this.fourop(0x8, reg, this.register(o), 0x0); }
//             else if (o == "random") { this.inst(0xC0 | reg, this.shortValue()); }
//             else if (o == "key") { this.inst(0xF0 | reg, 0x0A); }
//             else if (o == "delay") { this.inst(0xF0 | reg, 0x07); }
//             else { this.inst(0x60 | reg, this.shortValue(o)); }
//         }
//         else if ("+=" == token) {
//             if (this.isRegister()) { this.fourop(0x8, reg, this.register(), 0x4); }
//             else { this.inst(0x70 | reg, this.shortValue()); }
//         }
//         else if ("|=" == token) { this.fourop(0x8, reg, this.register(), 0x1); }
//         else if ("&=" == token) { this.fourop(0x8, reg, this.register(), 0x2); }
//         else if ("^=" == token) { this.fourop(0x8, reg, this.register(), 0x3); }
//         else if ("-=" == token) { this.fourop(0x8, reg, this.register(), 0x5); }
//         else if ("=-" == token) { this.fourop(0x8, reg, this.register(), 0x7); }
//         else if (">>=" == token) { this.fourop(0x8, reg, this.register(), 0x6); }
//         else if ("<<=" == token) { this.fourop(0x8, reg, this.register(), 0xE); }
//         else {
//             throw "Unrecognized operator '" + token + "'.";
//         }
//     }

//     private resolveLabel = function (offset) {
//         var target = (this.here() + offset);
//         var label = this.checkName(this.next(), "label");
//         if ((target == 0x202) && (label == "main")) {
//             this.hasmain = false;
//             this.rom = [];
//             this.hereaddr = 0x200;
//             target = this.here();
//         }
//         if (label in this.dict) { throw "The name '" + label + "' has already been defined."; }
//         this.dict[label] = target;

//         if (label in this.protos) {
//             for (var z = 0; z < this.protos[label].length; z++) {
//                 var addr = this.protos[label][z];
//                 if (this.longproto[addr]) {
//                     // i := long target
//                     this.rom[addr - 0x200] = (target >> 8) & 0xFF;
//                     this.rom[addr - 0x1FF] = (target & 0xFF);
//                 }
//                 else if ((this.rom[addr - 0x200] & 0xF0) == 0x60) {
//                     // :unpack target
//                     if ((target & 0xFFF) != target)
//                         throw "Value '" + target + "' for label '" + label + "' cannot not fit in 12 bits!";
//                     this.rom[addr - 0x1FF] = (this.rom[addr - 0x1FF] & 0xF0) | ((target >> 8) & 0xF);
//                     this.rom[addr - 0x1FD] = (target & 0xFF);
//                 }
//                 else {
//                     if ((target & 0xFFF) != target)
//                         throw "Value '" + target + "' for label '" + label + "' cannot not fit in 12 bits!";
//                     this.rom[addr - 0x200] = (this.rom[addr - 0x200] & 0xF0) | ((target >> 8) & 0xF);
//                     this.rom[addr - 0x1FF] = (target & 0xFF);
//                 }
//             }
//             delete this.protos[label];
//         }
//     }

//     private instruction = function (token) {
//         if (token == ":") { this.resolveLabel(0); }
//         else if (token == ":next") { this.resolveLabel(1); }
//         else if (token == ":unpack") {
//             var v = this.tinyValue();
//             var a = this.wideValue();
//             this.inst(0x60 | this.aliases["unpack-hi"], (v << 4) | (a >> 8));
//             this.inst(0x60 | this.aliases["unpack-lo"], a);
//         }
//         else if (token == ":breakpoint") { this.breakpoints[this.here()] = this.next(); }
//         else if (token == ":proto") { this.next(); } // deprecated.
//         else if (token == ":alias") { 
//             let aliasName = this.next();
//             this.aliases[this.checkName(this.next(), "alias")] = this.register();
//             let lineNumber = this.tokens[0][3];
//             symbols[]
//             // TODO: add line
            
//         }
//         else if (token == ":const") {
//             var name = this.checkName(this.next(), "constant");
//             if (name in this.constants) { throw "The name '" + name + "' has already been defined."; }
//             this.constants[name] = this.constantValue();
//         }
//         else if (token == ":org") { this.hereaddr = this.constantValue(); }
//         else if (token == ";") { this.inst(0x00, 0xEE); }
//         else if (token == "return") { this.inst(0x00, 0xEE); }
//         else if (token == "clear") { this.inst(0x00, 0xE0); }
//         else if (token == "bcd") { this.inst(0xF0 | this.register(), 0x33); }
//         else if (token == "save") {
//             var reg = this.register();
//             if (this.tokens.length > 0 && this.peek() == "-") {
//                 this.expect("-");
//                 this.xo = true;
//                 this.inst(0x50 | reg, (this.register() << 4) | 0x02);
//             }
//             else {
//                 this.inst(0xF0 | reg, 0x55);
//             }
//         }
//         else if (token == "load") {
//             var reg = this.register();
//             if (this.tokens.length > 0 && this.peek() == "-") {
//                 this.expect("-");
//                 this.xo = true;
//                 this.inst(0x50 | reg, (this.register() << 4) | 0x03);
//             }
//             else {
//                 this.inst(0xF0 | reg, 0x65);
//             }
//         }
//         else if (token == "delay") { this.expect(":="); this.inst(0xF0 | this.register(), 0x15); }
//         else if (token == "buzzer") { this.expect(":="); this.inst(0xF0 | this.register(), 0x18); }
//         else if (token == "if") {
//             var control = this.controlToken();
//             if (control[0] == "then") {
//                 this.conditional(false);
//                 this.expect("then");
//             }
//             else if (control[0] == "begin") {
//                 this.conditional(true);
//                 this.expect("begin");
//                 this.branches.push([this.here(), this.pos, "begin"]);
//                 this.inst(0x00, 0x00);
//             }
//             else {
//                 this.pos = control;
//                 throw "Expected 'then' or 'begin'.";
//             }
//         }
//         else if (token == "else") {
//             if (this.branches.length < 1) {
//                 throw "This 'else' does not have a matching 'begin'.";
//             }
//             this.jump(this.branches.pop()[0], this.here() + 2);
//             this.branches.push([this.here(), this.pos, "else"]);
//             this.inst(0x00, 0x00);
//         }
//         else if (token == "end") {
//             if (this.branches.length < 1) {
//                 throw "This 'end' does not have a matching 'begin'.";
//             }
//             this.jump(this.branches.pop()[0], this.here());
//         }
//         else if (token == "jump0") { this.immediate(0xB0, this.wideValue()); }
//         else if (token == "jump") { this.immediate(0x10, this.wideValue()); }
//         else if (token == "native") { this.immediate(0x00, this.wideValue()); }
//         else if (token == "sprite") {
//             var r1 = this.register();
//             var r2 = this.register();
//             var size = this.tinyValue();
//             if (size == 0) { this.schip = true; }
//             this.inst(0xD0 | r1, (r2 << 4) | size);
//         }
//         else if (token == "loop") {
//             this.loops.push([this.here(), this.pos]);
//             this.whiles.push(null);
//         }
//         else if (token == "while") {
//             if (this.loops.length < 1) {
//                 throw "This 'while' is not within a loop.";
//             }
//             this.conditional(true);
//             this.whiles.push(this.here());
//             this.immediate(0x10, 0);
//         }
//         else if (token == "again") {
//             if (this.loops.length < 1) {
//                 throw "This 'again' does not have a matching 'loop'.";
//             }
//             this.immediate(0x10, this.loops.pop()[0]);
//             while (this.whiles[this.whiles.length - 1] != null) {
//                 this.jump(this.whiles.pop(), this.here());
//             }
//             this.whiles.pop();
//         }
//         else if (token == "plane") {
//             var plane = this.tinyValue();
//             if (plane > 3) { throw "the plane bitmask must be [0, 3]."; }
//             this.xo = true;
//             this.inst(0xF0 | plane, 0x01);
//         }
//         else if (token == "audio") {
//             this.xo = true;
//             this.inst(0xF0, 0x02);
//         }
//         else if (token == "scroll-down") { this.schip = true; this.inst(0x00, 0xC0 | this.tinyValue()); }
//         else if (token == "scroll-up") { this.xo = true; this.inst(0x00, 0xD0 | this.tinyValue()); }
//         else if (token == "scroll-right") { this.schip = true; this.inst(0x00, 0xFB); }
//         else if (token == "scroll-left") { this.schip = true; this.inst(0x00, 0xFC); }
//         else if (token == "exit") { this.schip = true; this.inst(0x00, 0xFD); }
//         else if (token == "lores") { this.schip = true; this.inst(0x00, 0xFE); }
//         else if (token == "hires") { this.schip = true; this.inst(0x00, 0xFF); }
//         else if (token == "saveflags") {
//             var flags = this.register();
//             if (flags > 7) { throw "saveflags argument must be v[0,7]."; }
//             this.schip = true;
//             this.inst(0xF0 | flags, 0x75);
//         }
//         else if (token == "loadflags") {
//             var flags = this.register();
//             if (flags > 7) { throw "loadflags argument must be v[0,7]."; }
//             this.schip = true;
//             this.inst(0xF0 | flags, 0x85);
//         }
//         else if (token == "i") {
//             this.iassign(this.next());
//         }
//         else if (this.isRegister(token)) {
//             this.vassign(this.register(token), this.next());
//         }
//         else {
//             this.immediate(0x20, this.wideValue(token));
//         }
//     }

//     public Go = function () {
//         this.aliases["compare-temp"] = 0xE;
//         this.aliases["unpack-hi"] = 0x0;
//         this.aliases["unpack-lo"] = 0x1;

//         this.inst(0, 0); // reserve a jump slot
//         while (this.tokens.length > 0) {
//             if (typeof this.peek() == "number") {
//                 var nn = this.next();
//                 if (nn < -128 || nn > 255) {
//                     throw "Literal value '" + nn + "' does not fit in a byte- must be in range [-128, 255].";
//                 }
//                 this.data(nn);
//             }
//             else {
//                 this.instruction(this.next());
//             }
//         }
//         if (this.hasmain == true) {
//             // resolve the main branch
//             this.jump(0x200, this.wideValue("main"));
//         }
//         var keys = [];
//         for (var k in this.protos) { keys.push(k); }
//         if (keys.length > 0) {
//             throw "Undefined names: " + keys;
//         }
//         if (this.loops.length > 0) {
//             this.pos = this.loops[0][1];
//             throw "This 'loop' does not have a matching 'again'.";
//         }
//         if (this.branches.length > 0) {
//             this.pos = this.branches[0][1];
//             throw "This '" + this.branches[0][2] + "' does not have a matching 'end'.";
//         }
//         for (var index = 0; index < this.rom.length; index++) {
//             if (typeof this.rom[index] == "undefined") { this.rom[index] = 0x00; }
//         }
//     }
// }

// function decimalFormat(num) {
//     var dec = num.toString(10);
//     return dec;
// }

// function hexFormat(num) {
//     var hex = num.toString(16).toUpperCase();
//     var pad0 = zeroPad(hex.length, 2);
//     return "0x" + pad0 + hex;
// }

// function binaryFormat(num) {
//     var bin = num.toString(2);
//     var pad0 = zeroPad(bin.length, 8);
//     return "0b" + pad0 + bin;
// }

// var zeroes = "00000000";
// function zeroPad(strLen, byteLength) {
//     var dif = strLen % byteLength;
//     if (dif == 0) { return ""; }

//     var len = byteLength - dif;
//     var pad0 = zeroes.substr(0, len);
//     return pad0;
// }

// this.Compiler = Compiler;
