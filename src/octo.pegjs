program
 = body:statement* { return { type: "Program", body: body, location: location() }; }

statement
 = keywordExpression / assignmentExpression / number / ifStatement / loopStatement
 / label / region / directive / _

region
 = ":" _ id:label _ body:statement* { return { type: "Region", id: id, body: body, location: location() }; }

// expressionStatement

// CONTROL FLOW
ifStatement
 = ifKeyword _ test:testExpression _ thenKeyword _ consequent:statement* { return { type: "IfStatement", test: test, consequent: consequent, location: location() }; }
 / ifKeyword _ test:testExpression _ beginKeyword _ consequent:statement* endKeyword { return { type: "IfStatement", test: test, consequent: consequent, location: location() }; }
 / ifKeyword _ test:testExpression _ beginKeyword _ consequent:statement* elseKeyword _ alternate:statement* endKeyword { return { type: "IfStatement", test: test, consequent: consequent, alternate: alternate, location: location() }; }

loopStatement
 = loopKeyword _ body:(statement / whileStatement)* againKeyword { return { type: "LoopStatement", body: body, location: location() }; }

// SUB_DEF
 whileStatement
  = whileKeyword _ test:testExpression { return { type: "WhileStatement", test: test, location: location() }; }

testExpression
 = one:aliasable _ op:comparisonOperator _ two:(number / aliasable)  { return { type: "testExpression", one: one, op: op, two: two, location: location() }; }
 / one:aliasable _ op:(keyKeyword / "-" keyKeyword) { return { type: "testExpression", one: one, op: op, location: location() }; }

comparisonOperator
 = op:("==" / "!=" / "<" / ">" / "<=" / ">=")

// ASSIGNMENT
assignmentExpression
 // vx operations
 = one:aliasable _ op:(">>=" / "<<=" / "|=" / "&=" / "^=" / "-=" / "=-") _ two:(aliasable) { return { type: "AssignmentExpression", one: one, op: op, two: two, location: location() }; }
 / one:aliasable _ op:"+=" _ two:(number / aliasable) { return { type: "AssignmentExpression", one: one, op: op, two: two, location: location() }; }
 / one:aliasable _ op:":=" _ two:(aliasable / delayKeyword / randomExpression / keyKeyword)
 // i operations
 / one:iRegister _ op:"+=" _ two:aliasable { return { type: "AssignmentExpression", one: one, op: op, two: two, location: location() }; }
 / one:iRegister _ op:":=" _ two:(address / addressExpression) { return { type: "AssignmentExpression", one: one, op: op, two: two, location: location() }; }
 // buzzer/delay operations
 / one:(buzzerKeyword / delayKeyword) _ op:":=" _ two:aliasable { return { type: "AssignmentExpression", one: one, op: op, two: two, location: location() }; }

randomExpression
 = op:randomKeyword _ one:address { return { type: "randomExpression", op: op, one: one, location: location(), }; }

addressExpression
 = op:(hexKeyword / bigHexKeyword / longKeyword) _ one:address { return { type: "addressExpression", op: op, one: one, location: location() }; }

keywordExpression
 = op:(audioKeyword / scrollLeftKeyword / scrollRightKeyword / returnKeyword / clearKeyword
       / breakpointKeyword / hiresKeyword / loresKeyword / exitKeyword) { return { type: "KeywordExpression",op: op, location: location(),  }; }

// UNARY EXPRESSION
unaryExpression
 = op:(randomKeyword / hexKeyword / bigHexKeyword / bcdKeyword / saveKeyword / loadKeyword) _ one:aliasable { return { type: "Unaryexpression", op: op, one: one, location: location(), }; }
 / op:(longKeyword / orgKeyword / jumpKeyword / jumpZeroKeyword / saveKeyword
       / loadKeyword / scrollUpKeyword / scrollDownKeyword / planeKeyword) _ one:address { return { type: "Unaryexpression", op: op, one: one, location: location(), }; }

// KEYWORD STATEMENTS
directive
 = op:constKeyword _ one:label _ two:number { return { type: "Directive", op: op, one: one, two: two, location: location() }; }
 / op:aliasKeyword _ one:label _ two:aliasable { return {type: "Directive", op: op, one: one, two: two, location: location() }; }
 / op:unpackKeyword _ one:address _ two:label { return {type: "Directive", op: op, one: one, two: two, location: location() }; }
 / op:(saveKeyword / loadKeyword) _ one:aliasable _ "-" _ two:aliasable { return {type: "Directive", op: op, one: one, two: two, location: location() }; }
 / op:nextKeyword _ one:label _ two:statement { return {type: "Directive", op: op, one: one, two: two, location: location() }; }
 / op:spriteKeyword _ one:aliasable _ two:aliasable _ three:address { return {type: "Directive", op: op, one: one, two: two, three: three, location: location() }; }

// NEAR TERMINAL SYMBOLS (only small wrappers, value must be a primative)
address
 = number / label

number
 = number:(binary / hex / decimal) //{ return { type: "number", value: number, location: location() }; }

binary
 = "0b" decimal

hex
 = "0x" decimal

decimal
 = value:[0-9]+ { return value.join(''); }

aliasable
 = vRegister / label

vRegister
 = register:("v"[0-9a-fA-F]) { return { type: "vRegister", value: register.join('') }; }

iRegister
 = register:("i")

label // TODO: verify that this is correct
 = value:$(word !reservedWord) //{ return { type: "label", value: value, location: location() }; }

word
= value:[a-z0-9-_?]i+ { return value.join(''); }

reservedWord
 = keyword / number / vRegister / iRegister // operators - skip because they aren't valid labels

keyword
 = colonKeyword / returnKeyword / clearKeyword / bcdKeyword
 / saveKeyword / loadKeyword / spriteKeyword / jumpKeyword
 / jumpZeroKeyword / constKeyword / aliasKeyword / breakpointKeyword
 / hexKeyword / keyKeyword / notKeyKeyword / colonKeyword
 / randomKeyword / delayKeyword / buzzerKeyword / scrollKeyword / hiresKeyword
 / loresKeyword / bigHexKeyword / exitKeyword / saveflagsKeyword
 / loadflagsKeyword / audioKeyword / planeKeyword / longKeyword
 / ifKeyword / thenKeyword / elseKeyword / beginKeyword / endKeyword
 / orgKeyword / nextKeyword

// --- octo keywords
colonKeyword
 = ":"

returnKeyword
 = "return" / ";"

clearKeyword
 = "clear"

bcdKeyword
 = "bcd"

saveKeyword
 = "save"

loadKeyword
 = "load"

spriteKeyword
 = "sprite"

jumpKeyword
 = "jump"

jumpZeroKeyword
 = "jump0"

constKeyword
 = ":const"

aliasKeyword
 = ":alias"

breakpointKeyword
 = ":breakpoint"

unpackKeyword
 = ":unpack"

orgKeyword
 = ":org"

nextKeyword
 = ":next"

hexKeyword
 = "hex"

randomKeyword
 = "random"

keyKeyword
 = "key"

notKeyKeyword
 = "-key"

delayKeyword
 = "delay"

buzzerKeyword
 = "buzzer"

scrollKeyword
 = scrollDownKeyword / scrollUpKeyword / scrollLeftKeyword / scrollRightKeyword

// -- conditional keywords
ifKeyword
 = "if"

thenKeyword
 = "then"

elseKeyword
 = "else"

beginKeyword
 = "begin"

endKeyword
 = "end"

loopKeyword
 = "loop"

againKeyword
 = "again"

whileKeyword
 = "while"

// -- superchip keywords
hiresKeyword
 = "hires"

loresKeyword
 = "lores"

scrollDownKeyword
 = "scroll-down"

scrollLeftKeyword
 = "scroll-left"

scrollRightKeyword
 = "scroll-right"

bigHexKeyword
 = "bighex"

exitKeyword
 = "exit"

saveflagsKeyword
 = "saveflags"

loadflagsKeyword
 = "loadflags"

// -- xo keywords
scrollUpKeyword
 = "scroll-up"

planeKeyword
 = "plane"

audioKeyword
 = "audio"

longKeyword
 = "long"

// misc
_ "trivia" // - TODO: decide if I should pass along like roslyn does to regenerate source from AST
 = trivia:(lb / ws / comment)+ { return { type: "trivia", value: trivia.join(''), location: location() }; }

comment
 = start:"#" rest:([^\n])* { return start + rest.join(''); }

ws "whitespace"
 = whitespace:[ \t]+ { return whitespace.join(''); }

lb
 = "\n"
