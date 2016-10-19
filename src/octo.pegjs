// TODO: replace most 'ws' with '_' because newline and comments are also acceptable separators
// TODO: add :next
program
 = (_ / directive / blockStatement / routine)*

directive
 = constStatement / aliasStatement

routine
 = labelStatement blockStatement*

blockStatement
 = returnStatement / clearStatement / bcdStatement / saveStatement 
 / loadStatement / spriteStatement / jumpStatement / jumpZeroStatement
 / resStatement / exitStatement / scrollStatement / flagsStatement
 / saveRangeStatement / loadRangeStatement / planeStatement / audioStatement
 / assignment / number / ifThenStatement / ifBeginBlock / label / _

// CONTROL FLOW


ifThenStatement
 = ifKeyword _ conditional _ thenKeyword _ blockStatement

ifBeginBlock
 = ifKeyword _ conditional _ beginKeyword _ blockStatement* (elseBlock / endKeyword)

elseBlock
 = elseKeyword _ blockStatement* endKeyword

loopBlock
 = loopKeyword _ (blockStatement / whileStatement)* (ifKeyword _ conditional _ thenKeyword)? againKeyword

 whileStatement
  = whileKeyword _ conditional

ifKeyword
 = "if" { return { type: "ifKeyword", value: "if", location: location() }; }

thenKeyword
 = "then" { return { type: "thenKeyword", value: "then", location: location() }; }

elseKeyword
 = "else" { return { type: "elseKeyword", value: "else", location: location() }; }

beginKeyword
 = "begin" { return { type: "beginKeyword", value: "begin", location: location() }; }

endKeyword
 = "end" { return { type: "endKeyword", value: "end", location: location() }; }

loopKeyword
 = "loop" { return { type: "loopKeyword", value: "loop", location: location() }; }

againKeyword
 = "again" { return { type: "againKeyword", value: "again", location: location() }; }

whileKeyword
 = "while" { return { type: "whileKeyword", value: "while", location: location() }; }

conditional
 = keyConditional / notKeyConditional / equalityConditional / inequalityConditional
/ lessThanConditional / greaterThanConditional / lessThanOrEqualConditional / greaterThanOrEqualConditional

keyConditional
 = destination:(aliasable) ws key:keyKeyword { return { type: "keyConditional", location:location(), value: [destination, key]}; }

notKeyConditional
 = destination:(aliasable) ws key:notKeyKeyword { return { type: "notKeyConditional", location:location(), value: [destination, key]}; }

equalityConditional
 = destination:(aliasable) ws operator:equalityOperator ws value:(number / aliasable) { return { type: "equalityConditional", location: location(), value: [destination, operator, value] }; }

equalityOperator
 = "==" { return { type: "equalityOperator", value: "==", location: location() }; }

inequalityConditional
 = register:(aliasable) ws operator:inequalityOperator ws value:(number / aliasable) { return { type: "inequalityConditional", location: location(), value: [register, operator, value] }; }

inequalityOperator
 = "!=" { return { type: "inequalityOperator", value: "!=", location: location() }; }

lessThanConditional
 = register:(aliasable) ws operator:lessThanOperator ws value:(number / aliasable) { return { type: "lessThanConditional", location: location(), value: [register, operator, value] }; }

lessThanOperator
 = "<" { return { type: "lessThanOperator", value: "<", location: location() }; }

greaterThanConditional
 = register:(aliasable) ws operator:greaterThanOperator ws value:(number / aliasable) { return { type: "greaterThanConditional", location: location(), value: [register, operator, value] }; }

greaterThanOperator
 = ">" { return { type: "greaterThanOperator", value: ">", location: location() }; }

lessThanOrEqualConditional
 = register:(aliasable) ws operator:lessThanOrEqualOperator ws value:(number / aliasable) { return { type: "lessThanOrEqualConditional", location: location(), value: [register, operator, value] }; }

lessThanOrEqualOperator
 = "<=" { return { type: "lessThanOrEqualOperator", value: "<=", location: location() }; }

greaterThanOrEqualConditional
 = register:(aliasable) ws operator:greaterThanOrEqualOperator ws value:(number / aliasable) { return { type: "greaterThanOrEqualConditional", location: location(), value: [register, operator, value] }; }

greaterThanOrEqualOperator
 = ">=" { return { type: "greaterThanOrEqualOperator", value: "<=", location: location() }; }

// ASSIGNMENT
assignment
 = directAssignment / addAssignment / minusAssignment 
/ bitwiseAssignment / shiftAssignment

// SHIFT ASSIGNMENTS
shiftAssignment
 = dest:(aliasable) ws op:shiftAssignmentOperator ws source:(aliasable) { return { type: "shiftAssignment", value: [dest, op, source], location: location() }; }

shiftAssignmentOperator
 = operator:(">>=" / "<<=") { return { type: "shiftAssignmentOperator", value: operator, location: location() }; }

// BITWISE ASSIGNMENTS
bitwiseAssignment
 = dest:(aliasable) ws op:bitwiseAssignmentOperator ws source:(aliasable) { return { type: "bitwiseAssignment", value: [dest, op, source], location: location() }; }

bitwiseAssignmentOperator
 = operator:("|=" / "&=" / "^=") { return { type: "bitwiseAssignmentOperator", value: operator, location: location() }; }

// MINUS ASSIGNMENTS
minusAssignment
 = dest:(aliasable) ws op:minusAssignmentOperator ws source:(aliasable) { return { type: "minusAssignment", value: [dest, op, source], location: location() }; }

minusAssignmentOperator
 = operator:("-=" / "=-") { return { type: "minusAssignmentOperator", value: operator, location: location() }; }

// ADD ASSIGNMENTS
addAssignment
 = dest:(aliasable) ws op:addAssignmentOperator ws source:(number / aliasable) { return { type: "addAssignment", value: [dest, op, source], location: location() }; }
 / dest:iRegister ws op:addAssignmentOperator ws source:(aliasable) { return { type: "addAssignment", value: [dest, op, source], location: location() }; }

addAssignmentOperator
 = operator:("+=") { return { type: "addAssignmentOperator", value: operator, location: location() }; }

// DIRECT ASSIGNMENTS
// TODO: Fix this. Allowed i register assignments are different from vregister assignments
directAssignment
 = dest:directAssignmentDestination ws op:directAssignmentOperator ws source:directAssignmentSource { return { type: "directAssignment", value: [dest, op, source], location: location() }; }

directAssignmentSource 
 = source:(aliasable / delay / number / hexExpression / bigHexExpression / longExpression / randomExpression) { return { type: "directAssignmentSource", value: source, location: location() }; }

directAssignmentDestination
 = dest:(aliasable / iRegister / buzzer / delay) { return { type: "directAssignmentDestination", value: dest, location: location() }; }

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
 = keyword:longKeyword ws value:number { return { type: "longExpression", location: location(), value: [keyword, value] }; }

// STATEMENTS
statement
 = octoStatement / superchipStatement / xoStatement

octoStatement
 = returnStatement / clearStatement / bcdStatement / saveStatement 
 / loadStatement / spriteStatement / jumpStatement / jumpZeroStatement
 / aliasStatement / constStatement

// -- octo statements
labelStatement
 = keyword:colonKeyword ws label:label { return { type: "labelStatement", location: location(), value: [keyword, label]}; }

constStatement
 = keyword:constKeyword ws label:label ws value:number { return { type: "constStatement", location: location(), value: [keyword, label, value]}}

aliasStatement
 = keyword:aliasKeyword ws label:label ws register:(aliasable) { return { type: "aliasStatement", location: location(), value: [keyword, label, register]}}

breakpointStatement
 = keyword:breakpointKeyword { return { type: "breakpointStatement", location: location(), value: [keyword] }; }

returnStatement
 = keyword:returnKeyword { return { type: "returnStatement", location: location(), value: [keyword] }; }

clearStatement
 = keyword:clearKeyword { return { type: "clearStatement", location: location(), value: [keyword] }; }

bcdStatement
 = keyword:bcdKeyword ws value:aliasable { return { type: "bcdStatement", location: location(), value: [keyword, value] }; }

saveStatement
 = keyword:saveKeyword ws value:aliasable { return { type: "saveStatement", location: location(), value: [keyword, value] }; }

loadStatement
 = keyword:loadKeyword ws value:aliasable { return { type: "loadStatement", location: location(), value: [keyword, value] }; }

spriteStatement
 = keyword:spriteKeyword ws x:aliasable ws y:aliasable ws height:address { return { type: "spriteStatement", location: location(), value: [keyword, x, y, height] }; }

jumpStatement
 = keyword:jumpKeyword ws value:address { return { type: "jumpStatement", location: location(), value: [keyword, value] }; }

jumpZeroStatement
 = keyword:jumpZeroKeyword ws value:address { return { type: "jumpZeroStatement", location: location(), value: [keyword, value] }; }

// -- superchip statements
superchipStatement
 = resStatement / exitStatement / scrollVerticalStatement / flagsStatement

resStatement
 = keyword:(hiresKeyword / loresKeyword) { return { type: "resStatement", location: location(), value: [keyword] }; }

exitStatement
 = keyword:(exitKeyword) { return { type: "exitStatement", location: location(), value: [keyword] }; }

scrollStatement
 = scrollVerticalStatement / scrollHorizontalStatement

// TODO: scroll up/down can be 0-15
scrollVerticalStatement
 = keyword:(scrollUpKeyword / scrollDownKeyword) ws value:number { return { type: "scrollVerticalStatement", location: location(), value: [keyword, value] }; }

scrollHorizontalStatement
 = keyword:(scrollLeftKeyword / scrollRightKeyword) { return { type:"scrollHorizontalStatement", location: location, value: [keyword]}}

flagsStatement
 = keyword:(saveKeyword / loadKeyword) ws value:[0-7] { return { type: "flagsStatement", location: location(), value: [keyword, value] }; }

// -- xo statements
xoStatement
 = saveRangeStatement / loadRangeStatement / planeStatement / audioStatement

saveRangeStatement
 = keyword:saveKeyword ws start:aliasable ws "-" ws end:aliasable { return { type: "saveRangeStatement", location: location(), value: [keyword, start, end] }; }

loadRangeStatement
 = keyword:loadKeyword ws start:aliasable ws "-" ws end:aliasable { return { type: "loadRangeStatement", location: location(), value: [keyword, start, end] }; }

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

label // TODO: check if this is correct
//  = pre:nonAlphaLabelCharacter* mid:[a-z]i+ post:nonAlphaLabelCharacter* { return { type: "label", value: pre.join('') + mid.join('') + post.join(''), location: location() }; }
 = $(word !reservedWord)

word
= [a-z0-9-_?]i+

reservedWord
 = keyword / number / vRegister / iRegister // operators

keyword
 = colonKeyword / returnKeyword / clearKeyword / bcdKeyword
 / saveKeyword / loadKeyword / spriteKeyword / jumpKeyword
 / jumpZeroKeyword / constKeyword / aliasKeyword / breakpointKeyword
 / hexKeyword / keyKeyword / notKeyKeyword / colonKeyword
 / randomKeyword / delay / buzzer / scrollKeyword / hiresKeyword
 / loresKeyword / bigHexKeyword / exitKeyword / saveflagsKeyword
 / loadflagsKeyword / audioKeyword / planeKeyword / longKeyword
 / ifKeyword / thenKeyword / elseKeyword / beginKeyword / endKeyword

// TERMINAL SYMBOLS
nonAlphaLabelCharacter
 = number / [-_]

decimal
 = number:([0-9]+) { return { type: "decimal", value: number.join(''), location: location() }; }

// --- octo keywords
colonKeyword
 = keyword:":" { return { type: "colonKeyword", value: keyword, location: location() }; }

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

notKeyKeyword
 = "-key" { return { type: "notKeyKeyword", value: "-key", location: location() }; }

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
 = "bighex" { return { type: "bigHexKeyword", value: "bigHex", location: location() }; }

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

address
 = number / label

iRegister
 = register:("i") { return { type: "iRegister", value: register, location: location() }; }

aliasable
 = label / vRegister

vRegister
 = register:("v"[0-9a-fA-F]) { return { type: "vRegister", value: register.join(''), location: location() }; }

comment
 = start:"#" rest:([^\n])* { return start + rest.join(''); }

ws "whitespace"
 = whitepsace:[ \t]+

_ // trivia - TODO: decide if I should pass along like roslyn does to regenerate source from AST
 = trivia:(lb / ws / comment)+ { return { type: "trivia", value: trivia, location: location() }; }

lb
 = "\n"
