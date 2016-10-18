program
 = (_ / expression)*

expression
= simpleExpression / directAssignmentExpression

/*
Remaining Assignment Operators:
":=" / "+=" / "-=" / "=-"
 / "|=" / "&=" / "^=" / ">>=" / "<<="
*/

// DIRECT ASSIGNMENTS
directAssignmentExpression
 = dest:directAssignmentDestination ws op:directAssignmentOperator ws source:directAssignmentSource { return { type: "directAssignmentExpression", value: [dest, op, source], location: location() }; }

directAssignmentSource 
 = source:(vRegister / delay / number / hexExpression / randomExpression) { return { type: "directAssignmentSource", value: source, location: location() }; }

directAssignmentDestination
 = dest:(vRegister / iRegister / buzzer / delay) { return { type: "directAssignmentDestination", value: dest, location: location() }; }

directAssignmentOperator
 = operator:(":=") { return { type: "directAssignmentOperator", value: operator, location: location() }; }

// SIMPLE EXPRESSIONS
simpleExpression
= constExpression / aliasExpression / hexExpression / randomExpression

constExpression
= keyword:constKeyword ws label:label ws value:number { return { type: "constExpression", location: location(), value: [keyword, label, value]}}

aliasExpression
 = keyword:aliasKeyword ws label:label ws register:(label / vRegister) { return { type: "aliasExpression", location: location(), value: [keyword, label, register]}}

hexExpression
 = keyword:hexKeyword ws value:number { return { type: "hexExpression", location: location(), value: [keyword, value]}}

randomExpression
 = keyword:randomKeyword ws value:number { return { type: "randomExpression", location: location(), value: [keyword, value]}}

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

constKeyword
 = ":const" { return { type: "constKeyword", value: "const", location: location() }; }

aliasKeyword
 = ":alias" { return { type: "aliasKeyword", value: ":alias", location: location() }; }

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
