// TODO: fix where RETURN statements can go.
// TODO: number parsing is broken. xF is a label
program
 = body:statement* { return { type: "Program", body: body, location: location() }; }

statement
 = loopStatement / ifStatement / unaryExpression / assignmentExpression 
 / declaration / directive / label / keywordExpression / number / _

declaration "declaraction"
 = op:constKeyword _ one:label _ two:number { return { type: "Declaration", op: op, one: one, two: two, location: location() }; }
 / op:aliasKeyword _ one:label _ two:aliasable { return {type: "Declaration", op: op, one: one, two: two, location: location() }; }
 / op:":" _ one:label _ two:statement* returnKeyword* { return { type: "Declaration", op: op, one: one, two: two, location: location() }; }

// CONTROL FLOW
ifStatement "if statement"
 = ifKeyword _ test:testExpression _ beginKeyword _ consequent:(statement / returnKeyword)* elseKeyword _ alternate:(statement / returnKeyword)* endKeyword { return { type: "IfStatement", test: test, consequent: consequent, alternate: alternate, location: location() }; }
 / ifKeyword _ test:testExpression _ beginKeyword _ consequent:(statement / returnKeyword)* endKeyword { return { type: "IfStatement", test: test, consequent: consequent, location: location() }; }
 / ifKeyword _ test:testExpression _ thenKeyword _ consequent:(statement / returnKeyword)* { return { type: "IfStatement", test: test, consequent: consequent, location: location() }; }

loopStatement "loop statement"
 = loopKeyword _ body:(whileStatement / statement / returnKeyword)* againKeyword { return { type: "LoopStatement", body: body, location: location() }; }

// SUB_DEF
 whileStatement "while statement"
  = whileKeyword _ test:testExpression { return { type: "WhileStatement", test: test, location: location() }; }

testExpression "test expression"
 = one:aliasable _ op:comparisonOperator _ two:(number / aliasable)  { return { type: "TestExpression", one: one, op: op, two: two, location: location() }; }
 / one:aliasable _ op:(keyKeyword / "-" keyKeyword) { return { type: "TestExpression", one: one, op: op, location: location() }; }

operator "operator"
 = comparisonOperator / assignmentOperator

comparisonOperator "comparison operator"
 = op:("==" / "!=" / "<=" / ">=" / "<" / ">")

assignmentOperator "assignment operator"
 = ">>=" / "<<=" / "|=" / "&=" / "^=" / "-=" / "=-" / "+=" / ":="

// ASSIGNMENT
assignmentExpression "assignment expression"
 // vx operations
 = one:aliasable _ op:(">>=" / "<<=" / "|=" / "&=" / "^=" / "-=" / "=-") _ two:(aliasable) { return { type: "AssignmentExpression", op: op, one: one, two: two, location: location() }; }
 / one:aliasable _ op:"+=" _ two:(number / aliasable) { return { type: "AssignmentExpression", op: op, one: one, two: two, location: location() }; }
 / one:aliasable _ op:":=" _ two:(number / aliasable / delayKeyword / randomExpression / keyKeyword) { return { type: "AssignmentExpression", op: op, one: one, two: two, location: location() }; }
 // i operations
 / one:iRegister _ op:"+=" _ two:aliasable { return { type: "AssignmentExpression", op: op, one: one, two: two, location: location() }; }
 / one:iRegister _ op:":=" _ two:(address / addressExpression) { return { type: "AssignmentExpression", op: op, one: one, two: two, location: location() }; }
 // buzzer/delay operations
 / one:(buzzerKeyword / delayKeyword) _ op:":=" _ two:aliasable { return { type: "AssignmentExpression", op: op, one: one, two: two, location: location() }; }

randomExpression
 = op:randomKeyword _ one:address { return { type: "RandomExpression", op: op, one: one, location: location(), }; }

addressExpression
 = op:longKeyword _ one:address { return { type: "AddressExpression", op: op, one: one, location: location() }; }
 / op:(hexKeyword / bigHexKeyword) _ one:aliasable { return { type: "AddressExpression", op: op, one: one, location: location() }; }

keywordExpression
 = op:(audioKeyword / scrollLeftKeyword / scrollRightKeyword / clearKeyword
       / breakpointKeyword / hiresKeyword / loresKeyword / exitKeyword) { return { type: "KeywordExpression",op: op, location: location() }; }

// UNARY EXPRESSION
unaryExpression
 = op:(randomKeyword / hexKeyword / bigHexKeyword / bcdKeyword / saveKeyword / loadKeyword) _ one:aliasable { return { type: "UnaryExpression", op: op, one: one, location: location() }; }
 / op:(longKeyword / orgKeyword / jumpKeyword / jumpZeroKeyword / saveKeyword
       / loadKeyword / scrollUpKeyword / scrollDownKeyword / planeKeyword) _ one:address { return { type: "UnaryExpression", op: op, one: one, location: location() }; }

// KEYWORD STATEMENTS
directive "directive"
 = op:unpackKeyword _ one:address _ two:label { return {type: "Directive", op: op, one: one, two: two, location: location() }; }
 / op:(saveKeyword / loadKeyword) _ one:aliasable _ "-" _ two:aliasable { return {type: "Directive", op: op, one: one, two: two, location: location() }; }
 / op:nextKeyword _ one:label _ two:statement { return {type: "Directive", op: op, one: one, two: two, location: location() }; }
 / op:spriteKeyword _ one:aliasable _ two:aliasable _ three:address { return {type: "Directive", op: op, one: one, two: two, three: three, location: location() }; }

// NEAR TERMINAL SYMBOLS (only small wrappers, value must be a primative)
address
 = number / label

number "number"
 = number:(binary / hex / decimal) { return { type: "Number", value: number, location: location() }; }

binary
 = prefix:"0b" value:[01]+ { return prefix + value.join(''); }

hex
 = prefix:"0x" value:[0-9a-fA-F]+ { return prefix + value.join(''); }

decimal
 = value:[0-9]+ { return value.join(''); }

aliasable "vregister or alias"
 = vRegister / label

vRegister "v regiser"
 = register:("v"[0-9a-fA-F]) { return { type: "vRegister", value: register.join(''), location: location() }; }

iRegister "i regiser"
 = register:("i") { return { type: "iRegister", value: register, location: location() }; }

label "label" // TODO: verify that this is correct
//  = !(reservedWord &_) value:[a-z0-9-_?]i+ { return { type: "Label", value: value.join(''), location: location() }; }
 = !(reservedWord &_) !(_) value:[^ \t\r\n]+ { return { type: "Label", value: value.join(''), location: location() }; }

reservedWord
 = keyword / number / vRegister / iRegister / operator //- skip because they aren't valid labels

keyword // TODO: am i missing any?
 = colonKeyword / returnKeyword / clearKeyword / bcdKeyword
 / saveKeyword / loadKeyword / spriteKeyword / jumpKeyword
 / jumpZeroKeyword / constKeyword / aliasKeyword / breakpointKeyword
 / hexKeyword / bigHexKeyword / keyKeyword / notKeyKeyword
 / randomKeyword / delayKeyword / buzzerKeyword / scrollKeyword / hiresKeyword
 / loresKeyword / exitKeyword / saveflagsKeyword / loadflagsKeyword
 / audioKeyword / planeKeyword / longKeyword / unpackKeyword
 / ifKeyword / thenKeyword / elseKeyword / beginKeyword / endKeyword
 / orgKeyword / nextKeyword / loopKeyword / whileKeyword / againKeyword

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
 = "delay" { return { type: "delay", value: "delay", location: location() }; }

buzzerKeyword
 = "buzzer" { return { type: "buzzer", value: "buzzer", location: location() }; }

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
 = trivia:(comment / ws)+ { return { type: "Trivia", value: trivia.join(''), location: location() }; }

comment "comment"
 = start:"#" rest:([^\n])* { return start + rest.join(''); }

ws "whitespace"
 = whitespace:[ \t\r\n]+ { return whitespace.join(''); }