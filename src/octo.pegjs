program
 = (_ / expression / statement)*

expression
= assignmentExpression

assignmentExpression
= directAssignmentExpression / addAssignmentExpression / minusAssignmentExpression 
/ bitwiseAssignmentExpression / shiftAssignmentExpression

// SHIFT ASSIGNMENTS
shiftAssignmentExpression
= dest:vRegister ws op:shiftAssignmentOperator ws source:vRegister { return { type: "shiftAssignmentExpression", value: [dest, op, source], location: location() }; }

shiftAssignmentOperator
 = operator:(">>=" / "<<=") { return { type: "shiftAssignmentOperator", value: operator, location: location() }; }

// BITWISE ASSIGNMENTS
bitwiseAssignmentExpression
= dest:vRegister ws op:bitwiseAssignmentOperator ws source:vRegister { return { type: "bitwiseAssignmentExpression", value: [dest, op, source], location: location() }; }

bitwiseAssignmentOperator
 = operator:("|=" / "&=" / "^=") { return { type: "bitwiseAssignmentOperator", value: operator, location: location() }; }

// MINUS ASSIGNMENTS
minusAssignmentExpression
= dest:vRegister ws op:minusAssignmentOperator ws source:vRegister { return { type: "minusAssignmentExpression", value: [dest, op, source], location: location() }; }

minusAssignmentOperator
 = operator:("-=" / "=-") { return { type: "minusAssignmentOperator", value: operator, location: location() }; }

// ADD ASSIGNMENTS
addAssignmentExpression
 = dest:vRegister ws op:addAssignmentOperator ws source:(vRegister / number) { return { type: "addAssignmentExpression", value: [dest, op, source], location: location() }; }
 / dest:iRegister ws op:addAssignmentOperator ws source:(vRegister) { return { type: "addAssignmentExpression", value: [dest, op, source], location: location() }; }

addAssignmentOperator
 = operator:("+=") { return { type: "addAssignmentOperator", value: operator, location: location() }; }

// DIRECT ASSIGNMENTS
// TODO: Fix this. Allowed i register assignments are different from vregister assignments
directAssignmentExpression
 = dest:directAssignmentDestination ws op:directAssignmentOperator ws source:directAssignmentSource { return { type: "directAssignmentExpression", value: [dest, op, source], location: location() }; }

directAssignmentSource 
 = source:(vRegister / delay / number / hexExpression / bigHexExpression / longExpression / randomExpression) { return { type: "directAssignmentSource", value: source, location: location() }; }

directAssignmentDestination
 = dest:(vRegister / iRegister / buzzer / delay) { return { type: "directAssignmentDestination", value: dest, location: location() }; }

directAssignmentOperator
 = operator:(":=") { return { type: "directAssignmentOperator", value: operator, location: location() }; }

// OPERAND EXPRESSIONS
randomExpression
 = keyword:randomKeyword ws value:number { return { type: "randomExpression", location: location(), value: [keyword, value]}}

hexExpression
 = keyword:hexKeyword ws value:number { return { type: "hexExpression", location: location(), value: [keyword, value]}}

// -- superchip expression
bigHexExpression
 = keyword:bigHexKeyword ws value:number { return { type: "bigHexExpression", location: location(), value: [keyword, value]}}

// -- xo expression
longExpression
= keyword:longKeyword value:number { return { type: "longExpression", location: location(), value: [keyword, value] }; }

// STATEMENTS
statement
= octoStatement / superchipStatement / xoStatement

octoStatement
 = returnStatement / clearStatement / bcdStatement / saveStatement 
 / loadStatement / spriteStatement / jumpStatement / jumpZeroStatement
 / aliasStatement / constStatement

// -- octo statements
constStatement
= keyword:constKeyword ws label:label ws value:number { return { type: "constStatement", location: location(), value: [keyword, label, value]}}

aliasStatement
 = keyword:aliasKeyword ws label:label ws register:(label / vRegister) { return { type: "aliasStatement", location: location(), value: [keyword, label, register]}}

breakpointStatement
 = keyword:breakpointKeyword { return { type: "breakpointStatement", location: location(), value: [keyword] }; }

returnStatement
 = keyword:returnKeyword { return { type: "returnStatement", location: location(), value: [keyword] }; }

clearStatement
 = keyword:clearKeyword { return { type: "clearStatement", location: location(), value: [keyword] }; }

bcdStatement
 = keyword:bcdKeyword ws value:vRegister { return { type: "bcdStatement", location: location(), value: [keyword, value] }; }

saveStatement
 = keyword:saveKeyword ws value:vRegister { return { type: "saveStatement", location: location(), value: [keyword, value] }; }

loadStatement
 = keyword:loadKeyword ws value:vRegister { return { type: "loadStatement", location: location(), value: [keyword, value] }; }

spriteStatement
 = keyword:spriteKeyword ws x:vRegister ws y:vRegister ws height:number { return { type: "spriteStatement", location: location(), value: [keyword, x, y, height] }; }

jumpStatement
 = keyword:jumpKeyword ws value:number { return { type: "jumpStatement", location: location(), value: [keyword, value] }; }

jumpZeroStatement
 = keyword:jumpZeroKeyword ws value:number { return { type: "jumpZeroStatement", location: location(), value: [keyword, value] }; }

// -- superchip statements
superchipStatement
 = resStatement / exitStatement / scrollStatement / flagsStatement

resStatement
= keyword:(hiresKeyword / loresKeyword) { return { type: "resStatement", location: location(), value: [keyword] }; }

exitStatement
= keyword:(exitKeyword) { return { type: "exitStatement", location: location(), value: [keyword] }; }

// TODO: scroll left/right can only be 1-4, scroll up/down can be 0-15
scrollStatement
 = keyword:scrollKeyword ws value:number { return { type: "scrollStatement", location: location(), value: [keyword, value] }; }

flagsStatement
 = keyword:(saveKeyword / loadKeyword) ws value:[0-7] { return { type: "flagsStatement", location: location(), value: [keyword, value] }; }

// -- xo statements
xoStatement
 = saveRangeStatement / loadRangeStatement / planeStatement / audioStatement

saveRangeStatement
= keyword:saveKeyword ws start:vRegister ws "-" ws end:vRegister { return { type: "saveRangeStatement", location: location(), value: [keyword, start, end] }; }

loadRangeStatement
= keyword:loadKeyword ws start:vRegister ws "-" ws end:vRegister { return { type: "loadRangeStatement", location: location(), value: [keyword, start, end] }; }

planeStatement
= keyword:planeKeyword ws value:[0-3] { return { type: "planeStatement", location: location(), value: [keyword, value] }; }

audioStatement
= keyword:audioKeyword { return { type: "audioStatement", location: location(), value: [keyword] }; }

// NEAR TERMINAL SYMBOLS (only small wrappers, value must be a primative)
number
 = number:(binary / hex / decimal) { return { type: "number", value: number, location: location() }; }

binary
 = number:("0b" decimal) { return { type: "hex", value: number.join(''), location: location() }; }

hex
 = number:("0x" decimal) { return { type: "hex", value: number.join(''), location: location() }; }

label
 = pre:nonAlphaLabelCharacter* mid:[a-z]i+ post:nonAlphaLabelCharacter* { return { type: "label", value: pre.join('') + mid.join('') + post.join(''), location: location() }; }

// TERMINAL SYMBOLS
nonAlphaLabelCharacter
 = number / [-_]

decimal
 = number:([0-9]+) { return { type: "decimal", value: number.join(''), location: location() }; }

// --- octo keywords
returnKeyword
 = keyword:("return" / ";") { return { type: "returnKeyword", value: keyword, location: location() }; }

clearKeyword
 = "clear" { return { type: "clearKeyword", value: "clear", location: location() }; }

bcdKeyword
 = "bcd" { return { type: "bcdKeyword", value: "bcd", location: location() }; }

saveKeyword
 = "save" { return { type: "saveKeyword", value: "save", location: location() }; }

loadKeyword
 = "load" { return { type: "loadKeyword", value: "load", location: location() }; }

spriteKeyword
 = "sprite" { return { type: "spriteKeyword", value: "sprite", location: location() }; }

jumpKeyword
 = "jump" { return { type: "jumpKeyword", value: "jump", location: location() }; }

jumpZeroKeyword
 = "jump0" { return { type: "jumpZeroKeyword", value: "jump0", location: location() }; }

constKeyword
 = ":const" { return { type: "constKeyword", value: "const", location: location() }; }

aliasKeyword
 = ":alias" { return { type: "aliasKeyword", value: ":alias", location: location() }; }

breakpointKeyword
 = ":breakpoint" { return { type: "breakpointKeyword", value: ":breakpoint", location: location() }; }

hexKeyword
 = "hex" { return { type: "hexKeyword", value: "hex", location: location() }; }

randomKeyword
 = "random" { return { type: "randomKeyword", value: "random", location: location() }; }

keyKeyword
 = "key" { return { type: "keyKeyword", value: "key", location: location() }; }

delay
 = "delay" { return { type: "delay", value: "delay", location: location() }; }

buzzer
 = "buzzer" { return { type: "buzzer", value: "delay", location: location() }; }

scrollKeyword
 = scrollDownKeyword / scrollUpKeyword / scrollLeftKeyword / scrollRightKeyword

// -- superchip keywords
hiresKeyword
 = "hires" { return { type: "hiresKeyword", value: "hires", location: location() }; }

loresKeyword
 = "lores" { return { type: "loresKeyword", value: "lores", location: location() }; }

scrollDownKeyword
 = "scroll-down" { return { type: "scrollDownKeyword", value: "scroll-down", location: location() }; }

scrollLeftKeyword
 = "scroll-left" { return { type: "scrollLeftKeyword", value: "scroll-left", location: location() }; }

scrollRightKeyword
 = "scroll-right" { return { type: "scrollRightKeyword", value: "scroll-right", location: location() }; }

bigHexKeyword
 = "bigHex" { return { type: "bigHexKeyword", value: "bigHex", location: location() }; }

exitKeyword
 = "exit" { return { type: "exitKeyword", value: "exit", location: location() }; }

saveflagsKeyword
 = "saveflags" { return { type: "saveflagsKeyword", value: "saveflags", location: location() }; }

loadflagsKeyword
 = "loadflags" { return { type: "loadflagsKeyword", value: "loadflags", location: location() }; }

// -- xo keywords
scrollUpKeyword
 = "scroll-up" { return { type: "scrollUpKeyword", value: "scroll-up", location: location() }; }

planeKeyword
 = "plane" { return { type: "planeKeyword", value: "plane", location: location() }; }

audioKeyword
 = "audio" { return { type: "audioKeyword", value: "audio", location: location() }; }

longKeyword
 = "long" { return { type: "longKeyword", value: "long", location: location() }; }

// misc

iRegister
 = register:("i") { return { type: "iRegister", value: register, location: location() }; }
  
vRegister
 = register:("v"[0-9a-fA-F]) { return { type: "vRegister", value: register.join(''), location: location() }; }

comment
= start:"#" rest:([^\n])* { return start + rest.join(''); }

ws
 = whitepsace:[ \t]+

_ // trivia - TODO: decide if I should pass along like roslyn does to regenerate source from AST
 = trivia:(lb / ws / comment)+ { return { type: "trivia", value: trivia, location: location() }; }

lb
 = "\n"
