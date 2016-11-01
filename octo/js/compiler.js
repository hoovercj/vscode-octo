"use strict";

////////////////////////////////////
//
//   Tokenization:
//
////////////////////////////////////

function parse(token) {
	var num = parseNumber(token);
	return isNaN(num) ? token : num;
}

function parseNumber(token) {

	// Check if this token is a valid binary number
	if (/^[+\-]?0b[01]+$/.test(token)) {

		var bitstring;
		var isNegative = (token.indexOf('-') == 0);

		// Check for any leading +/- sign character
		if(isNegative || (token.indexOf('+') == 0)) {
			// Remove sign character and 0b- prefix
			bitstring = token.slice(3);
		} else {
			// Remove 0b- prefix
			bitstring = token.slice(2);
		}

		var value = parseInt(bitstring, 2);
		return (isNegative) ? -value : value;
	}

	// Check if this token is a valid hexadecimal number
	if (/^[+\-]?0x[0-9a-f]+$/i.test(token)) {
		return parseInt(token, 16);
	}

	// Check if this token is a valid decimal number
	if (/^[+\-]?[0-9]+$/.test(token)) {
		return parseInt(token, 10);
	}

	return NaN;
}

// Parse the source code and split into tokens 
// using whitespace and newlines as delimiters
// Tokens: [
// 	[ symbol: string,
// 	tokenStart: number,
// 	tokenEnd: number ]
// ]
function tokenize(text) {
	var ret   = [];
	var index = 0;
	var token = "";
	var tokenStart = -1;

	// while index is less than the length of the text
	while(index < text.length) {
		// c is the current character at index
		var c = text.charAt(index++);
		// if c is a # to start a comment
		if (c == '#') {
			// if there is already a token started (i.e. this is not the beginning of the line)
			// push the current token and reset tokenStart
			if (token.length > 0) {
				ret.push([ parse(token), tokenStart, index ]);
				tokenStart = -1;
			}
			// Set the token to the empty string. This ensures that comments will be
			// excluded from the list of tokens
			// Then continue iterating through the text until the end or a new line character is found.
			token = "";
			while(c != '\n' && index < text.length) {
				c = text.charAt(index++);
			}
		}
		// if c is any type of whitespace (space, tab, new line, return)
		// then push the current token (if it exists), reset tokenStart,
		// and set token to an empty string so the whitespace isn't emitted
		else if (" \t\n\r\v".indexOf(c) >= 0) {
			if (token.length > 0) {
				ret.push([ parse(token), tokenStart, index ]);
				tokenStart = -1;
			}
			token = "";
		}
		// we know that c is now a non-comment and non-whitespace character
		// so append it to the token  value.
		// If tokenStart == -1 then we know we are starting a new token and set
		// tokenStart to the current index.
		else {
			if (tokenStart == -1) { tokenStart = index; }
			token += c;
		}
	}
	// The entire text has been tokenized. If there is still a token, push it.
	if (token.length > 0) {
		ret.push([ parse(token), tokenStart, index+1]);
	}
	return ret;
}

////////////////////////////////////
//
//   The Octo Compiler:
//
////////////////////////////////////

// A utility function to generate debug information
// This information includes an array of source code lines,
// a function to map a tokenition to the source code line,
// and an object and function for mapping compiled instructions
// to the line of source code
function DebugInfo(source) {
	// Split the lines
	this.lines = source.split('\n');
	// Given a tokenition (as an absolute index in the file)
	// return the line number that it corresponds to
	this.tokenToLine = function(token) {
		var i;
		// Iterate over the lines and subtract their length from the tokenition
		// until it is less than zero. Return that line number.
		for (i = 0; i < this.lines.length; i++) {
			token -= this.lines[i].length + 1;
			if (token <= 0)
				break;
		}
		return i;
	}
	// this.locs maps a compiled instruction address to a line
	this.locs = {}; // map<addr, line>
	this.mapAddr = function(addr, token) {
		this.locs[addr] = this.tokenToLine(token);
	}
}

const START_ADDRESS = START_ADDRESS;
const TOKEN_SYMBOL = 0;
const TOKEN_START = 1;
const TOKEN_END = 2;

function Compiler(source) {

	this.rom       = []; // list<int>
	this.dbginfo   = new DebugInfo(source);
	this.loops     = []; // stack<[addr, marker]>
	this.branches  = []; // stack<[addr, marker, type]>
	this.whiles    = []; // stack<int>
	// Labels -- named regions
	this.dict      = {}; // map<name, addr>
	this.protos    = {}; // map<name, list<addr>>
	this.longproto = {}; // set<name, true>
	this.aliases   = {}; // map<name, registernum>
	this.constants = {}; // map<name, token>
	this.hasmain = true;
	this.schip = false;
	this.xo = false;
	this.breakpoints = {}; // map<address, name>
	this.hereaddr = START_ADDRESS; // Represents the Chip8 address (data index + 0x200)

	this.token = null;

	// Saves the given byte at the current rom address and increments the address
	this.data = function(byte) {
		if (typeof this.rom[this.hereaddr - START_ADDRESS] != "undefined") {
			throw "Data overlap. Address " + hexFormat(this.hereaddr) + " has already been defined.";
		}
		this.rom[this.hereaddr - START_ADDRESS] = (byte & 0xFF);
		if (this.token) this.dbginfo.mapAddr(this.hereaddr, this.token[TOKEN_START]);
		this.hereaddr++;
	}

	this.tokens = tokenize(source);
	// Destructive iterator that assigns the next token to this.token,
	// removes that token from the array, and returns the symbol.
	this.next = function()    { this.token = this.tokens[0]; this.tokens.splice(0, 1); return this.token[TOKEN_SYMBOL]; }
	// Non-distructive peek which returns the next symbol.
	this.peek = function()    { return this.tokens[0][TOKEN_SYMBOL]; }
	// Returns the current Chip8 address (rom address + 0x200)
	this.here = function()    { return this.hereaddr; }
	// Saves the two bytes of an instruction to the current rom address, incrementing it in the process
	this.inst = function(upper,lower) { this.data(upper); this.data(lower); }

	// Saves the two bytes of an immediate instruction to the current rom address,
	// incrementing it in the process.
	// The first byte is the upper nibble of nnn OR'd with the opcode
	// The second byte is the lower byte of nnn
	this.immediate = function(op, nnn) {
		this.inst(op | ((nnn >> 8) & 0xF), (nnn & 0xFF));
	}

	// Saves the two bytes of an XYN instruction to the current rom address,
	// incrementing it in the process.
	// Upper byte: upper nibble is the opcode, lower nibble is X
	// Lower byte: upper nibble is y, lower nibble is n
	this.fourop = function(op, x, y, n) {
		this.inst((op << 4) | x, (y << 4) | (n & 0xF));
	}

	// Takes a rom address and a destination address
	// Sets the rom address (- START_ADDRESS) to the upper-most nibble prepended with a 1. (so 5 bits)
	// Sets the rom address + 1 (- START_ADDRESS) to the lower byte of destination. 
	this.jump = function(addr, dest) {
		this.rom[addr - START_ADDRESS] = (0x10 | ((dest >> 8) & 0xF));
		this.rom[addr - 0x1FF] = (dest & 0xFF);
	}

	// Returns true or false based on whether the symbol passed in OR
	// the next symbol (peek) is an alias or a V register (V0-VF)
	this.isRegister = function(name) {
		// if name evaluates to false without being 0 (when no args are passed in? so undefined/null??)
		// set name to peek.
		if (!name && (name != 0)) { name = this.peek(); } 
		if (typeof name != "string") { return false; }
		if (name in this.aliases) { return true; }
		name = name.toUpperCase();
		if (name.length != 2) { return false; }
		if (name[0] != 'V') { return false; }
		return "0123456789ABCDEF".indexOf(name[1]) >= 0;
	}

	// Returns the register number associated with the name (0-15).
	// In the case of an alias, the mapped value is returned.
	// If no argument is passed in DESTRUCTIVELY iterate tokens via next.
	this.register = function(name) {
		if (!name) { name = this.next(); }
		if (!this.isRegister(name)) {
			throw "Expected register, got '" + name + "'";
		}
		if (name in this.aliases) {
			return this.aliases[name];
		}
		name = name.toUpperCase();
		return "0123456789ABCDEF".indexOf(name[1]);
	}

	// Destructive iteration to get the next tokens that throws if the
	// parameter does not match the next token.
	this.expect = function(token) {
		var thing = this.next();
		if (thing != token) { throw "Expected '" + token + "', got '" + thing + "'!"; }
	}

	// Destructive iteration to get the next token that throws if
	// the token is not a number or is a "proto".
	this.constantValue = function() {
		var number = this.next();
		if (typeof number != "number") {
			// TODO: what is a proto?
			if (number in this.protos) {
				throw "Constants cannot refer to the address of a forward declaration.";
			}
			// If number is the name of a labeled region, return the address for that region
			else if (number in this.dict) {
				number = this.dict[number];
			}
			// If number is the name of a constant, return the token assigned to that constant
			else if (number in this.constants) {
				number = this.constants[number];
			}
			else { throw "Undefined name '"+number+"'."; }
		}
		return number;
	}

	// This includes all of the keywords and allowed operators
	this.reservedNames = {
		":=":true, "|=":true, "&=":true, "^=":true, "-=":true, "=-":true, "+=":true,
		">>=":true, "<<=":true, "==":true, "!=":true, "<":true, ">":true,
		"<=":true, ">=":true, "key":true, "-key":true, "hex":true, "bighex":true,
		"random":true, "delay":true, ":":true, ":next":true, ":unpack":true,
		":breakpoint":true, ":proto":true, ":alias":true, ":const":true,
		":org":true, ";":true, "return":true, "clear":true, "bcd":true,
		"save":true, "load":true, "buzzer":true, "if":true, "then":true,
		"begin":true, "else":true, "end":true, "jump":true, "jump0":true,
		"native":true, "sprite":true, "loop":true, "while":true, "again":true,
		"scroll-down":true, "scroll-right":true, "scroll-left":true,
		"lores":true, "hires":true, "loadflags":true, "saveflags":true, "i":true,
		"audio":true, "plane":true, "scroll-up":true
	};

	// Takes a name and kind and returns the name if it isn't reserved,
	// otherwise throws an error. The kind is only used in the error message.
	this.checkName = function(name, kind) {
		if (name in this.reservedNames) {
			throw "The name '"+name+"' is reserved and cannot be used for a " + kind + ".";
		}
		return name;
	}

	// Handles the NNNN part of a `long NNNN` statement
	// Destructively iterates to get the next token.
	// Checks if the value is a constant, a proto,
	// a labeled region, or a number.
	// returns the value or throws if it doesn't fit.
	this.veryWideValue = function() {
		// i := long NNNN
		var nnnn = this.next();
		if (typeof nnnn != "number") {
			if (nnnn in this.constants) {
				nnnn = this.constants[nnnn];
			}
			else if (nnnn in this.protos) {
				this.protos[nnnn].push(this.here()+2); // TODO: what does this do?
				this.longproto[this.here()+2] = true;
				nnnn = 0;
			}
			else if (nnnn in this.dict) {
				nnnn = this.dict[nnnn];
			}
			else {
				this.protos[this.checkName(nnnn, "label")] = [this.here()+2]; // TODO: what does this do?
				this.longproto[this.here()+2] = true;
				nnnn = 0;
			}
		}
		if ((typeof nnnn != "number") || (nnnn < 0) || (nnnn > 0xFFFF)) {
			throw "Value '"+nnnn+"' cannot fit in 16 bits!";
		}
		return (nnnn & 0xFFFF);
	}

	// Handles the NNN part of a jump or index assignment operation.
	// Destructively iterates to get the next token if one isn't provided.
	// Checks if the value is a constant, a proto,
	// a labeled region, or a number.
	// returns the value or throws if it doesn't fit.
	this.wideValue = function(nnn) {
		// can be forward references.
		// call, jump, jump0, i:=
		if (!nnn & (nnn != 0)) { nnn = this.next(); }
		if (typeof nnn != "number") {
			if (nnn in this.constants) {
				nnn = this.constants[nnn];
			}
			else if (nnn in this.protos) {
				this.protos[nnn].push(this.here());
				nnn = 0;
			}
			else if (nnn in this.dict) {
				nnn = this.dict[nnn];
			}
			else {
				this.protos[this.checkName(nnn, "label")] = [this.here()];
				nnn = 0;
			}
		}
		if ((typeof nnn != "number") || (nnn < 0) || (nnn > 0xFFF)) {
			throw "Value '"+nnn+"' cannot fit in 12 bits!";
		}
		return (nnn & 0xFFF);
	}

	// Handles the NN part of a v register assignment/comparison operation or a random statement.
	// Destructively iterates to get the next token if one isn't provided.
	// Checks if the value is a constant or a number.
	// returns the value or throws if it doesn't fit.
	this.shortValue = function(nn) {
		// vx:=, vx+=, vx==, v!=, random
		if (!nn && (nn != 0)) { nn = this.next(); }
		if (typeof nn != "number") {
			if (nn in this.constants) { nn = this.constants[nn]; }
			else { throw "Undefined name '"+nn+"'."; }
		}
		// silently trim negative numbers, but warn
		// about tokenitive numbers which are too large:
		if ((typeof nn != "number") || (nn < -128) || (nn > 255)) {
			throw "Argument '"+nn+"' does not fit in a byte- must be in range [-128, 255].";
		}
		return (nn & 0xFF);
	}

	// Handles the N part of a sprite length operation or the high nibble of an unpack statement.
	// Destructively iterates to get the next token.
	// Checks if the value is a constant or a number.
	// returns the value or throws if it doesn't fit.
	this.tinyValue = function() {
		// sprite length, unpack high nybble
		var n = this.next();
		if (typeof n != "number") {
			if (n in this.constants) { n = this.constants[n]; }
			else { throw "Undefined name '"+n+"'."; }
		}
		if ((typeof n != "number") || (n < 0) || (n > 15)) {
			throw "Invalid argument '"+n+"'; must be in range [0,15].";
		}
		return (n & 0xF);
	}

	// TODO
	this.conditional = function(negated) {
		// Destructively reads the next token as a register. If it isn't, it throws an exception.
		var reg   = this.register();
		var operator = this.next();
		var compTemp = this.aliases["compare-temp"];
		if (negated) {
			if      (operator == "=="  ) { operator = "!="; }
			else if (operator == "!="  ) { operator = "=="; }
			else if (operator == "key" ) { operator = "-key"; }
			else if (operator == "-key") { operator = "key"; }
			else if (operator == "<"   ) { operator = ">="; }
			else if (operator == ">"   ) { operator = "<="; }
			else if (operator == ">="  ) { operator = "<"; }
			else if (operator == "<="  ) { operator = ">"; }
		}
		// If operator is an (in)equality operator, peek at (and then read) the next token.
		// If it is a register, use the instruction for comparing registers (9XY0/5XY0)
		// Else use the instruction for comparing registers to NN values (4YNN/3XNN)
		// TODO: Why are the == and != backwards from the opcodes listed on wikipedia?
		if (operator == "==") {
			if (this.isRegister()) { this.inst(0x90 | reg, this.register() << 4); }
			else                   { this.inst(0x40 | reg, this.shortValue()); }
		}
		else if (operator == "!=") {
			if (this.isRegister()) { this.inst(0x50 | reg, this.register() << 4); }
			else                   { this.inst(0x30 | reg, this.shortValue()); }
		}
		// If operator is an key statement, use the key instructions (EXA1/EX9E)
		else if (operator == "key") {
			this.inst(0xE0 | reg, 0xA1);
		}
		else if (operator == "-key") {
			this.inst(0xE0 | reg, 0x9E);
		}
		// If operator is a comparison operator, peek at (and then read) the next token.
		// Then combine ops using a temp register to perform the desird comparison.
		// Use 8XY0 (Vx=Vy) to set the temp register to the right-hand side register value
		// OR Use 6XNN (Vx = NN) to set the temp register to the right-hand side short value
		// -- operator specific instructions
		else if (operator == ">") {
			if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
			else                   { this.inst  (0x60 | compTemp, this.shortValue()); }
			// Use 8XY5 (Vx -= Vy) to subtract the temporary register containing the right-hand side
			// from the original register/short value from the
			// If the borrow bit is 1 (no borrow, meaning the left-hand side is greater than the right) then...
			this.fourop(0x8, compTemp, reg, 0x5); // ve -= v1
			this.inst(0x3F, 1);                   // if vf == 1 then ...
		}
		else if (operator == "<") {
			if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
			else                   { this.inst  (0x60 | compTemp, this.shortValue()); }
			// Use 8XY7 (Vx=Vy-Vx) to subtract the original register/short value from the temporary register
			// containing the right-hand side
			// If the borrow bit is 1 (no borrow, meaning the left-hand side is less than the right) then...
			this.fourop(0x8, compTemp, reg, 0x7); // ve =- v1
			this.inst(0x3F, 1);                   // if vf == 1 then ...
		}
		else if (operator == ">=") {
			if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
			else                   { this.inst  (0x60 | compTemp, this.shortValue()); }
			// Use 8XY7 (Vx=Vy-Vx) to subtract the original register/short value from the temporary register
			// containing the right-hand side
			// If the borrow bit is 0 (borrow, meaning the left-hand side is greater than or equal to the right) then...
			this.fourop(0x8, compTemp, reg, 0x7); // ve =- v1
			this.inst(0x4F, 1);                   // if vf != 1 then ...
		}
		else if (operator == "<=") {
			if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); }
			else                   { this.inst  (0x60 | compTemp, this.shortValue()); }
			// Use 8XY5 (Vx -= Vy) to subtract the temporary register containing the right-hand side
			// from the original register/short value from the
			// If the borrow bit is 0 (borrow, meaning the left-hand side is less than or equal to the right) then...
			this.fourop(0x8, compTemp, reg, 0x5); // ve -= v1
			this.inst(0x4F, 1);                   // if vf != 1 then ...
		}
		else {
			throw "Conditional flag expected, got '" + operator + "!";
		}
	}

	// TODO
	this.controlToken = function() {
		// ignore a condition
		var op = this.tokens[1][TOKEN_SYMBOL];
		var index = 3;
		if (op == "key" || op == "-key") { index = 2; }
		if (index >= this.tokens.length) { index = this.tokens.length-1; }
		return this.tokens[index];
	}

	// TODO
	this.iassign = function(token) {
		if (token == ":=") {
			var o = this.next();
			if (o == "hex") { this.inst(0xF0 | this.register(), 0x29); }
			else if (o == "bighex") {
				this.schip = true;
				this.inst(0xF0 | this.register(), 0x30);
			}
			else if (o == "long") {
				this.xo = true;
				var addr = this.veryWideValue();
				this.inst(0xF0, 0x00);
				this.inst((addr>>8)&0xFF, addr&0xFF);
			}
			else { this.immediate(0xA0, this.wideValue(o)); }
		}
		else if (token == "+=") {
			this.inst(0xF0 | this.register(), 0x1E);
		}
		else {
			throw "The operator '"+token+"' cannot target the i register.";
		}
	}

	// TODO
	this.vassign = function(reg, token) {
		if (token == ":=") {
			var o = this.next();
			if (this.isRegister(o)) { this.fourop(0x8, reg, this.register(o), 0x0); }
			else if (o == "random") { this.inst(0xC0 | reg, this.shortValue()); }
			else if (o == "key")    { this.inst(0xF0 | reg, 0x0A); }
			else if (o == "delay")  { this.inst(0xF0 | reg, 0x07); }
			else                    { this.inst(0x60 | reg, this.shortValue(o)); }
		}
		else if ("+=" == token) {
			if (this.isRegister()) { this.fourop(0x8, reg, this.register(), 0x4); }
			else                   { this.inst(0x70 | reg, this.shortValue()); }
		}
		else if ("|="  == token) { this.fourop(0x8, reg, this.register(), 0x1); }
		else if ("&="  == token) { this.fourop(0x8, reg, this.register(), 0x2); }
		else if ("^="  == token) { this.fourop(0x8, reg, this.register(), 0x3); }
		else if ("-="  == token) { this.fourop(0x8, reg, this.register(), 0x5); }
		else if ("=-"  == token) { this.fourop(0x8, reg, this.register(), 0x7); }
		else if (">>=" == token) { this.fourop(0x8, reg, this.register(), 0x6); }
		else if ("<<=" == token) { this.fourop(0x8, reg, this.register(), 0xE); }
		else {
			throw "Unrecognized operator '"+token+"'.";
		}
	}

	// TODO
	this.resolveLabel = function(offset) {
		var target = (this.here() + offset);
		var label = this.checkName(this.next(), "label");
		if ((target == 0x202) && (label == "main")) {
			this.hasmain = false;
			this.rom = [];
			this.hereaddr = START_ADDRESS;
			target = this.here();
		}
		if (label in this.dict) { throw "The name '" + label + "' has already been defined."; }
		this.dict[label] = target;

		if (label in this.protos) {
			for(var z = 0; z < this.protos[label].length; z++) {
				var addr  = this.protos[label][z];
				if (this.longproto[addr]) {
					// i := long target
					this.rom[addr - START_ADDRESS] = (target >> 8) & 0xFF;
					this.rom[addr - 0x1FF] = (target & 0xFF);
				}
				else if ((this.rom[addr - START_ADDRESS] & 0xF0) == 0x60) {
					// :unpack target
					if ((target & 0xFFF) != target)
						throw "Value '" + target + "' for label '" + label + "' cannot not fit in 12 bits!";
					this.rom[addr - 0x1FF] = (this.rom[addr - 0x1FF] & 0xF0) | ((target >> 8)&0xF);
					this.rom[addr - 0x1FD] = (target & 0xFF);
				}
				else {
					if ((target & 0xFFF) != target)
						throw "Value '" + target + "' for label '" + label + "' cannot not fit in 12 bits!";
					this.rom[addr - START_ADDRESS] = (this.rom[addr - START_ADDRESS] & 0xF0) | ((target >> 8)&0xF);
					this.rom[addr - 0x1FF] = (target & 0xFF);
				}
			}
			delete this.protos[label];
		}
	}

	// TODO
	this.instruction = function(token) {
		if (token == ":") { this.resolveLabel(0); }
		else if (token == ":next") { this.resolveLabel(1); }
		else if (token == ":unpack") {
			var v = this.tinyValue();
			var a = this.wideValue();
			this.inst(0x60 | this.aliases["unpack-hi"], (v << 4) | (a >> 8));
			this.inst(0x60 | this.aliases["unpack-lo"], a);
		}
		else if (token == ":breakpoint") { this.breakpoints[this.here()] = this.next(); }
		else if (token == ":proto")  { this.next(); } // deprecated.
		else if (token == ":alias")  { this.aliases[this.checkName(this.next(), "alias")] = this.register(); }
		else if (token == ":const")  {
			var name = this.checkName(this.next(), "constant");
			if (name in this.constants) { throw "The name '"+name+"' has already been defined."; }
			this.constants[name] = this.constantValue();
		}
		else if (token == ":org")    { this.hereaddr = this.constantValue(); }
		else if (token == ";")       { this.inst(0x00, 0xEE); }
		else if (token == "return")  { this.inst(0x00, 0xEE); }
		else if (token == "clear")   { this.inst(0x00, 0xE0); }
		else if (token == "bcd")     { this.inst(0xF0 | this.register(), 0x33); }
		else if (token == "save")    {
			var reg = this.register();
			if (this.tokens.length > 0 && this.peek() == "-") {
				this.expect("-");
				this.xo = true;
				this.inst(0x50 | reg, (this.register() << 4) | 0x02);
			}
			else {
				this.inst(0xF0 | reg, 0x55);
			}
		}
		else if (token == "load") {
			var reg = this.register();
			if (this.tokens.length > 0 && this.peek() == "-") {
				this.expect("-");
				this.xo = true;
				this.inst(0x50 | reg, (this.register() << 4) | 0x03);
			}
			else {
				this.inst(0xF0 | reg, 0x65);
			}
		}
		else if (token == "delay")   { this.expect(":="); this.inst(0xF0 | this.register(), 0x15); }
		else if (token == "buzzer")  { this.expect(":="); this.inst(0xF0 | this.register(), 0x18); }
		else if (token == "if") {
			var control = this.controlToken();
			if (control[0] == "then") {
				this.conditional(false);
				this.expect("then");
			}
			else if (control[0] == "begin") {
				this.conditional(true);
				this.expect("begin");
				this.branches.push([this.here(), this.token, "begin"]);
				this.inst(0x00, 0x00);
			}
			else {
				this.token = control;
				throw "Expected 'then' or 'begin'.";
			}
		}
		else if (token == "else") {
			if (this.branches.length < 1) {
				throw "This 'else' does not have a matching 'begin'.";
			}
			this.jump(this.branches.pop()[0], this.here()+2);
			this.branches.push([this.here(), this.token, "else"]);
			this.inst(0x00, 0x00);
		}
		else if (token == "end") {
			if (this.branches.length < 1) {
				throw "This 'end' does not have a matching 'begin'.";
			}
			this.jump(this.branches.pop()[0], this.here());
		}
		else if (token == "jump0")   { this.immediate(0xB0, this.wideValue()); }
		else if (token == "jump")    { this.immediate(0x10, this.wideValue()); }
		else if (token == "native")  { this.immediate(0x00, this.wideValue()); }
		else if (token == "sprite")  {
			var r1 = this.register();
			var r2 = this.register();
			var size = this.tinyValue();
			if (size == 0) { this.schip = true; }
			this.inst(0xD0 | r1, (r2 << 4) | size);
		}
		else if (token == "loop") {
			this.loops.push([this.here(), this.token]);
			this.whiles.push(null);
		}
		else if (token == "while") {
			if (this.loops.length < 1) {
				throw "This 'while' is not within a loop.";
			}
			this.conditional(true);
			this.whiles.push(this.here());
			this.immediate(0x10, 0);
		}
		else if (token == "again") {
			if (this.loops.length < 1) {
				throw "This 'again' does not have a matching 'loop'.";
			}
			this.immediate(0x10, this.loops.pop()[0]);
			while (this.whiles[this.whiles.length - 1] != null) {
				this.jump(this.whiles.pop(), this.here());
			}
			this.whiles.pop();
		}
		else if (token == "plane") {
			var plane = this.tinyValue();
			if (plane > 3) { throw "the plane bitmask must be [0, 3]."; }
			this.xo = true;
			this.inst(0xF0 | plane, 0x01);
		}
		else if (token == "audio") {
			this.xo = true;
			this.inst(0xF0, 0x02);
		}
		else if (token == "scroll-down")  { this.schip = true; this.inst(0x00, 0xC0 | this.tinyValue()); }
		else if (token == "scroll-up")    { this.xo    = true; this.inst(0x00, 0xD0 | this.tinyValue()); }
		else if (token == "scroll-right") { this.schip = true; this.inst(0x00, 0xFB); }
		else if (token == "scroll-left")  { this.schip = true; this.inst(0x00, 0xFC); }
		else if (token == "exit")         { this.schip = true; this.inst(0x00, 0xFD); }
		else if (token == "lores")        { this.schip = true; this.inst(0x00, 0xFE); }
		else if (token == "hires")        { this.schip = true; this.inst(0x00, 0xFF); }
		else if (token == "saveflags") {
			var flags = this.register();
			if (flags > 7) { throw "saveflags argument must be v[0,7]."; }
			this.schip = true;
			this.inst(0xF0 | flags, 0x75);
		}
		else if (token == "loadflags") {
			var flags = this.register();
			if (flags > 7) { throw "loadflags argument must be v[0,7]."; }
			this.schip = true;
			this.inst(0xF0 | flags, 0x85);
		}
		else if (token == "i") {
			this.iassign(this.next());
		}
		else if (this.isRegister(token)) {
			this.vassign(this.register(token), this.next());
		}
		else {
			this.immediate(0x20, this.wideValue(token));
		}
	}

	// TODO
	this.go = function() {
		this.aliases["compare-temp"] = 0xE;
		this.aliases["unpack-hi"]    = 0x0;
		this.aliases["unpack-lo"]    = 0x1;

		this.inst(0, 0); // reserve a jump slot
		while(this.tokens.length > 0) {
			if (typeof this.peek() == "number") {
				var nn = this.next();
				if (nn < -128 || nn > 255) {
					throw "Literal value '"+nn+"' does not fit in a byte- must be in range [-128, 255].";
				}
				this.data(nn);
			}
			else {
				this.instruction(this.next());
			}
		}
		if (this.hasmain == true) {
			// resolve the main branch
			this.jump(START_ADDRESS, this.wideValue("main"));
		}
		var keys = [];
		for (var k in this.protos) { keys.push(k); }
		if (keys.length > 0) {
			throw "Undefined names: " + keys;
		}
		if (this.loops.length > 0) {
			this.token = this.loops[0][1];
			throw "This 'loop' does not have a matching 'again'.";
		}
		if (this.branches.length > 0) {
			this.token = this.branches[0][1];
			throw "This '"+this.branches[0][2]+"' does not have a matching 'end'.";
		}
		for(var index = 0; index < this.rom.length; index++) {
			if (typeof this.rom[index] == "undefined") { this.rom[index] = 0x00; }
		}
	}
}

this.Compiler = Compiler;
