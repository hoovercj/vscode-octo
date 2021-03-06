"use strict";

////////////////////////////////////
//
//   Prettyprinting
//
////////////////////////////////////

var zeroes = "00000000";

function maskFormat(mask) {
    if (emulator.maskFormatOverride) { return binaryFormat(mask);  }
    else                             { return numericFormat(mask); }
}

function numericFormat(num, format) {
    if (!format)
        format = emulator.numericFormatStr;

    if (format == "dec")      { return decimalFormat(num); }
    else if (format == "bin") { return binaryFormat(num);  }
    else if (format == "hex") { return hexFormat(num);     }

    return hexFormat(num);
}

function decimalFormat(num) {
    var dec = num.toString(10);
    return dec;
}

function hexFormat(num) {
    var hex  = num.toString(16).toUpperCase();
    var pad0 = zeroPad(hex.length, 2);
    return "0x" + pad0 + hex;
}

function binaryFormat(num) {
    var bin  = num.toString(2);
    var pad0 = zeroPad(bin.length, 8);
    return "0b" + pad0 + bin;
}

function zeroPad(strLen, byteLength) {
    var dif = strLen % byteLength;
    if (dif == 0) { return ""; }

    var len  = byteLength - dif;
    var pad0 = zeroes.substr(0, len);
    return pad0;
}

function display(rom) {
    return "[" + (rom.map(hexFormat).join(", ")) + "]";
}

////////////////////////////////////
//
//   Emulator Setup
//
////////////////////////////////////

// var intervalHandle = null;
var emulator = new Emulator();

function run() {
    unpackOptions(emulator, defaultOptions || {}); // defaultOptions are injected by my script
    document.getElementById('framerate').value = emulator.tickrate;
    if (emulator.screenRotation % 180 !== 0) {
        document.getElementById('emulator').classList.add('vertical');
    }
    var canvas = document.getElementById('target');
    getTransform(emulator, canvas);
    runRom(compile());
}

function compile() {
    var input  = document.getElementById("input");
    var output = document.getElementById("output");
    var status = document.getElementById("status");

    var MAX_ROM = 3584;
    if (emulator.enableXO) { MAX_ROM = 65536 - 512; }

    var c = new Compiler(input.value);
    try {
        output.value = "";
        c.go();
        if (c.xo && (!emulator.enableXO)) {
            throw "Rom makes use of XO-Chip extensions. They must be enabled in the Options panel.";
        }
        if (c.rom.length > MAX_ROM) {
            throw "Rom is too large- " + (c.rom.length-MAX_ROM) + " bytes over!";
        }
        output.value = display(c.rom);
        status.innerHTML = ((c.rom.length) + " bytes, " + (MAX_ROM-c.rom.length) + " free.");
        status.style.backgroundColor = "black";
        if (c.schip) { status.innerHTML += " (SuperChip instructions used)"; }
        if (c.xo) { status.innerHTML += " (XO-Chip instructions used)"; }
    }
    catch(error) {
        status.style.backgroundColor = "darkred";
        status.innerHTML = error;
        if (c.pos != null) {
            input.focus();
            input.selectionStart = c.pos[1]-1;
            input.selectionEnd   = c.pos[2]-1;
        }
        return null;
    }

    return {
        rom        :c.rom,
        breakpoints:c.breakpoints,
        dbginfo	   :c.dbginfo,
        aliases    :c.aliases,
        labels     :c.dict
    };
}

function runRom(rom) {
    if (rom === null) { return; }
    if (window.intervalHandle != null) { reset(); }
    emulator.exitVector = reset;
    emulator.importFlags = function() { return JSON.parse(localStorage.getItem("octoFlagRegisters")); }
    emulator.exportFlags = function(flags) { localStorage.setItem("octoFlagRegisters", JSON.stringify(flags)); }
    emulator.buzzTrigger = function(ticks, remainingTicks) { playPattern(ticks, emulator.pattern, remainingTicks); }
    emulator.init(rom);
    setRenderTarget("target");
    audioSetup();
    document.getElementById("content").style.backgroundColor = emulator.quietColor;
    window.addEventListener("keydown", keyDown, false);
    window.addEventListener("keyup", keyUp, false);
    window.intervalHandle = setInterval(render, 1000/60);
}

function reset() {
    window.removeEventListener("keydown", keyDown, false);
    window.removeEventListener("keyup"  , keyUp  , false);
    clearInterval(window.intervalHandle);
    clearBreakpoint();
    stopAudio();
}

// function share() {
//     // cribbed from increpare/Puzzlescript/js/toolbar.js
//     var xhr = new XMLHttpRequest();
//     xhr.open('POST', 'https://api.github.com/gists');
//     xhr.onreadystatechange = function() {
//         if (xhr.readyState !== 4) { return; }
//         var result = JSON.parse(xhr.responseText);
//         if (xhr.status === 403) {
//             alert(result.message);
//         }
//         else if (xhr.status !== 200 && xhr.status !== 201) {
//             alert("HTTP Error "+ xhr.status + ' - ' + xhr.statusText);
//         }
//         else {
//             window.location.href = window.location.href.replace(/(index.html|\?gist=.*)*$/, 'index.html?gist=' + result.id);
//         }
//     }
//     var prog = document.getElementById("input").value;
//     var options = JSON.stringify({
//         "tickrate"        : emulator.tickrate,
//         "fillColor"       : emulator.fillColor,
//         "fillColor2"      : emulator.fillColor2,
//         "blendColor"      : emulator.blendColor,
//         "backgroundColor" : emulator.backgroundColor,
//         "buzzColor"       : emulator.buzzColor,
//         "quietColor"      : emulator.quietColor,
//         "shiftQuirks"     : emulator.shiftQuirks,
//         "loadStoreQuirks" : emulator.loadStoreQuirks,
//         "vfOrderQuirks"   : emulator.vfOrderQuirks,
//         "clipQuirks"      : emulator.clipQuirks,
//         "jumpQuirks"      : emulator.jumpQuirks,
//         "enableXO"        : emulator.enableXO,
//         "screenRotation"  : emulator.screenRotation,
//     });
//     xhr.send(JSON.stringify({
//         "description" : "Octo Chip8 Program",
//         "public" : true,
//         "files": {
//             "readme.txt" : {
//                 "content": "Play this game by pasting the program into http://johnearnest.github.io/Octo/"
//             },
//             "prog.ch8" : { "content": prog },
//             "options.json": { "content": options }
//         }
//     }));
// }

////////////////////////////////////
//
//   Emulator Execution
//
////////////////////////////////////

function render() {
    if (emulator.metadata === {}
      || emulator.pc == null
      || emulator.metadata == null
      || emulator.metadata.breakpoints == null) {
        clearInterval(window.intervalHandle);
        return;
    }

    for(var z = 0; (z < emulator.tickrate) && (!emulator.waiting); z++) {
        if (emulator.breakpoint != true) {
            emulator.tick();
            if (emulator.pc in emulator.metadata.breakpoints) {
                haltBreakpoint(emulator.metadata.breakpoints[emulator.pc]);
            }
        }
    }
    if (emulator.breakpoint != true) {
        if (emulator.dt > 0) { emulator.dt--; }
        if (emulator.st > 0) { emulator.st--; }
    }
    renderDisplay(emulator);
    if (emulator.halted) { return; }
    document.getElementById("content").style.backgroundColor = (emulator.st > 0) ? emulator.buzzColor : emulator.quietColor;
}

function keyDown(event) {
    if (!(event.keyCode in emulator.keys)) {
        emulator.keys[event.keyCode] = true;
        if (event.keyCode in keymapInverse) {
            // add an "active" class to the current button
            var keyElement = document.getElementById(
                '0x' + keymapInverse[event.keyCode].toString(16).toUpperCase()
            );
            if (!(keyElement.className.match(/active/))) {
                keyElement.className += ' active';
            }
        }
    }
}

function keyUp(event) {
    if (event.keyCode in emulator.keys) {
        delete emulator.keys[event.keyCode];
        if (event.keyCode in keymapInverse) {
            var keyElement = document.getElementById(
                '0x' + keymapInverse[event.keyCode].toString(16).toUpperCase()
            );
            keyElement.className = keyElement.className.replace('active', '');
        }
    }
    if (event.keyCode == 27) { reset(); }
    if (event.keyCode == 73) { // i
        if (emulator.breakpoint) {
            clearBreakpoint();
        }
        else {
            haltBreakpoint("user interrupt");
        }
    }
    if (event.keyCode == 79) { // o
        if (emulator.breakpoint) {
            emulator.tick();
            renderDisplay(emulator);
            haltBreakpoint("single stepping");
        }
    }
    if (emulator.waiting) {
        for(var z = 0; z < 16; z++) {
            if (keymap[z] == event.keyCode) {
                emulator.waiting = false;
                emulator.v[emulator.waitReg] = z;
                return;
            }
        }
    }
}

////////////////////////////////////
//
//   Options
//
////////////////////////////////////

// called from index.html
function framerate() {
    var newTickrate = document.getElementById("framerate").value;
    emulator.tickrate = newTickrate;
    defaultOptions.tickrate = newTickrate;
}

////////////////////////////////////
//
//   Sprite editor stuff:
//
////////////////////////////////////

function toggleSpriteEditor() {
    var editor = document.getElementById("spriteEditor");
    if (editor.style.display == "none") {
        editor.style.display = "inline";
        // document.getElementById("options").style.display = "none";
        document.getElementById("bintools").style.display = "none";
        document.getElementById("audiotools").style.display = "none";
        document.getElementById("keypad").style.display = "none";
        showPixels();
    }
    else {
        editor.style.display = "none";
    }
}

function drawPalette() {
    var palette = document.getElementById("spriteEditorPalette");
    var render = palette.getContext("2d");
    render.clearRect(0, 0, palette.width, palette.height);
    for(var z = 0; z < 4; z++) {
        render.fillStyle = getColor(z);
        render.fillRect(z * 50, 0, 50, 25);

        render.fillStyle = "#000000";
        render.lineWidth = 0;
        // note: line drawing must occur at coordinates between pixels
        // to render accurate, crisp lines. This is ridiculous.
        if (z > 0) {
            render.beginPath();
            render.moveTo(z * 50 + 0.5, 0);
            render.lineTo(z * 50 + 0.5, 25);
            render.stroke();
        }
        if (z == selectedColor) {
            render.beginPath();
            if (z == 0) { render.rect(z * 50 + 1.5, 1.5, 47, 22); }
            else        { render.rect(z * 50 + 2.5, 1.5, 46, 22); }
            render.stroke();
        }
    }
}

function clickPalette(event) {
    var rect = document.getElementById("spriteEditorPalette").getBoundingClientRect();
    var mx = Math.floor((event.clientX - rect.left)/50);
    selectedColor = Math.max(0, Math.min(mx, 3));
    drawPalette();
}

function setSpriteEditorColor() {
    var check = document.getElementById("spriteEditorColor");
    var palette = document.getElementById("spriteEditorPalette");
    enableColor = check.checked;
    if (check.checked) {
        palette.style.display = "inline";
        drawPalette();
    }
    else {
        selectedColor = 1;
        palette.style.display = "none";
        var maxBytes = largeSprite ? 32 : 15;
        for(var z = maxBytes; z < 64; z++) { pixel[z] = 0; }
    }
    showPixels();
    showHex();
}

function setSpriteEditorSize() {
    var check = document.getElementById("spriteEditorSize");
    var canvas = document.getElementById("draw");
    if (check.checked) {
        largeSprite = true;
        canvas.width  = 25 * 16;
        canvas.height = 25 * 16;
        var newpixels = [];
        for(var z = 0; z < 64; z++) { newpixels[z] = 0; }
        for(var z = 0; z < 15; z++) {
            newpixels[z * 2] = pixel[z];
        }
        if (enableColor) {
            for(var z = 0; z < 15; z++) {
                newpixels[32 + (z * 2)] = pixel[15 + z];
            }
        }
        pixel = newpixels;
    }
    else {
        largeSprite = false;
        canvas.width  = 25 * 8;
        canvas.height = 25 * 15;
        var newpixels = [];
        for(var z = 0; z < 64; z++) { newpixels[z] = 0; }
        for(var z = 0; z < 15; z++) {
            newpixels[z] = pixel[z*2];
        }
        if (enableColor) {
            for(var z = 0; z < 15; z++) {
                newpixels[15 + z] = pixel[32 + z*2];
            }
        }
        pixel = newpixels;
    }
    showPixels();
    showHex();
}

function showPixels() {
    var canvas = document.getElementById("draw");
    var render = canvas.getContext("2d");
    render.fillStyle = emulator.backgroundColor;
    render.fillRect(0, 0, canvas.width, canvas.height);
    if (largeSprite) {
        for(var row = 0; row < 16; row++) {
            for(var col = 0; col < 16; col++) {
                var index = row*2 + (col > 7 ? 1:0);
                var mask  = (1 << (7-(col%8)));
                var set1 = (pixel[index     ] & mask) != 0;
                var set2 = (pixel[index + 32] & mask) != 0;
                if (!enableColor) { set2 = 0; }
                render.fillStyle = getColor(set1 + (2*set2));
                render.fillRect(col * 25, row * 25, 25, 25);
            }
        }
    }
    else {
        for(var row = 0; row < 15; row++) {
            for(var col = 0; col < 8; col++) {
                var mask = (1 << (7-col));
                var set1 = (pixel[row     ] & mask) != 0;
                var set2 = (pixel[row + 15] & mask) != 0;
                if (!enableColor) { set2 = 0; }
                render.fillStyle = getColor(set1 + (2*set2));
                render.fillRect(col * 25, row * 25, 25, 25);
            }
        }
    }
}

function showHex() {
    var output = document.getElementById("spriteData");
    var hex = "";
    var maxBytes = largeSprite ? 32 : 15;
    if (enableColor) { maxBytes *= 2; }
    for(var z = 0; z < maxBytes; z++) {
        var digits = pixel[z].toString(16).toUpperCase();
        hex += "0x" + (digits.length == 1 ? "0"+digits : digits) + " ";
        if (z % 8 == 7) { hex += "\n"; }
    }
    output.value = hex;
}

function editHex() {
    var output = document.getElementById("spriteData");
    var bytes = output.value.trim().split(new RegExp("\\s+"));
    var maxBytes = largeSprite ? 32 : 15;
    if (enableColor) { maxBytes *= 2; }
    for(var z = 0; z < maxBytes; z++) {
        if (z < bytes.length) {
            var tok = bytes[z].trim();
            var num = (tok.slice(0, 2) == "0b") ? parseInt(tok.slice(2),2) : parseInt(tok);
            pixel[z] = isNaN(num) ? 0 : num;
        }
        else {
            pixel[z] = 0;
        }
    }
    showPixels();
}

function drag(event) {
    if (mode == 0) { return; }
    var rect = document.getElementById("draw").getBoundingClientRect();
    var mx     = Math.floor((event.clientX - rect.left)/25);
    var my     = Math.floor((event.clientY - rect.top )/25);
    var dest   = largeSprite ? (my*2 + (mx > 7 ? 1:0)) : my;
    var stride = largeSprite ? 32 : 15;
    var src    = (128 >> (mx % 8));
    if (mode == 1) {
        // draw
        if ((selectedColor & 1) != 0) { pixel[dest]          |=  src; }
        else                          { pixel[dest]          &= ~src; }
        if ((selectedColor & 2) != 0) { pixel[dest + stride] |=  src; }
        else                          { pixel[dest + stride] &= ~src; }
    }
    else {
        pixel[dest]          &= ~src; // erase
        pixel[dest + stride] &= ~src;
    }
    showHex();
    showPixels();
}

function release(event)    { mode = 0; drag(event); }
function pressDraw(event)  { if (event.button == 2) {mode = 2;} else {mode = 1;} drag(event); }

var largeSprite = false;
var mode = 0;
var enableColor = false;
var selectedColor = 1;
var pixel = [];
for(var z = 0; z < 64; z++) { pixel[z] = 0; }

var spriteCanvas = document.getElementById("draw");
spriteCanvas.addEventListener("mousemove", drag, false);
spriteCanvas.addEventListener("mousedown", pressDraw, false);
spriteCanvas.addEventListener("mouseup"  , release, false);
spriteCanvas.oncontextmenu = function(event) { drag(event); return false; };
spriteCanvas.addEventListener("mouseout", release, false);
var spriteEditorPalette = document.getElementById("spriteEditorPalette");
spriteEditorPalette.addEventListener("click", clickPalette, false);

////////////////////////////////////
//
//   Virtual Keypad
//
////////////////////////////////////

function buttonDn(key) {
    keyDown({ keyCode: keymap[key]});
}
function buttonUp(key) {
    if (keymap[key] in emulator.keys) {
        keyUp({ keyCode: keymap[key]});
    }
}

for(var k = 0; k <= 0xF; k++) {
    var hex = k.toString(16).toUpperCase();
    var button = document.getElementById("0x" + hex);
    button.onmousedown = buttonDn.bind(undefined, k);
    button.onmouseup   = buttonUp.bind(undefined, k);
    button.onmouseout  = buttonUp.bind(undefined, k);

    button.ontouchstart = buttonDn.bind(undefined, k);
    button.ontouchenter = buttonDn.bind(undefined, k);
    button.ontouchleave = buttonUp.bind(undefined, k);
}

function toggleKeypad() {
    var keypad = document.getElementById("keypad");
    if (keypad.style.display == "none") {
        keypad.style.display = "block";
        // document.getElementById("options").style.display = "none";
        document.getElementById("bintools").style.display = "none";
        document.getElementById("spriteEditor").style.display = "none";
        document.getElementById("audiotools").style.display = "none";
    }
    else {
        keypad.style.display = "none";
    }
}

////////////////////////////////////
//
//   Debugger
//
////////////////////////////////////
var curBreakName;

var regNumFormat = {
    "pc": "hex",
    "i" : "hex",
    0x0 : "hex",
    0x1 : "hex",
    0x2 : "hex",
    0x3 : "hex",
    0x4 : "hex",
    0x5 : "hex",
    0x6 : "hex",
    0x7 : "hex",
    0x8 : "hex",
    0x9 : "hex",
    0xA : "hex",
    0xB : "hex",
    0xC : "hex",
    0xD : "hex",
    0xE : "hex",
    0xF : "hex"
}

function cycleNumFormat(register) {
    var curFormat = regNumFormat[register];
    if (!curFormat) {
        return;
    }

    if (curFormat == "hex") {
        regNumFormat[register] = "bin";
    }
    else if (curFormat == "bin") {
        regNumFormat[register] = "dec";
    }
    else {
        regNumFormat[register] = "hex";
    }

    haltBreakpoint(curBreakName);
}

function getLabel(address) {
    var bestname = "hex-font";
    var besta = 0;
    for(var key in emulator.metadata.labels) {
        var v = emulator.metadata.labels[key];
        if ((v > besta) && (v <= address)) {
            bestname = key;
            besta = v;
        }
    }
    if (besta == address) { return " (" + bestname + ")"; }
    return " (" + bestname + " + " + (address - besta) + ")";
}

function formatAliases(id) {
    var names = [];
    for(var key in emulator.metadata.aliases) {
        if (emulator.metadata.aliases[key] == id) { names.push(key); }
    }
    if (names.length == 0) { return ""; }
    var ret = " (" + names[0];
    for(var x = 1; x < names.length; x++) {
        ret += ", " + names[x];
    }
    return ret + ")";
}

function haltBreakpoint(breakName) {
    var button = document.getElementById("continueButton");
    var regs   = document.getElementById("registerView");
    var stack = document.getElementById("stacktraceView");
    button.style.display = "inline";
    regs.style.display = "inline";
    stack.style.display = "inline";

    var regdump =
        "<span>tick count: " + emulator.tickCounter + "</span><br>" +
        "<span>breakpoint: " + breakName + "</span><br>" +
        "<span onClick=\"cycleNumFormat('pc');\">pc := " + numericFormat(emulator.pc, regNumFormat["pc"]) + getLabel(emulator.pc) + "</span><br>" +
        "<span onClick=\"cycleNumFormat('i');\">i := " + numericFormat(emulator.i, regNumFormat["i"]) + getLabel(emulator.i) + "</span><br>";
    for(var k = 0; k <= 0xF; k++) {
        var hex = k.toString(16).toUpperCase();
        regdump += "<span onClick=\"cycleNumFormat('"+ k + "');\">v" + hex + " := " + numericFormat(emulator.v[k], regNumFormat[k]) + formatAliases(k) + "</span><br>";
    }

    var stackdump = "";
    stackdump += "<br>inferred stack trace:<br>";
    for(var x = 0; x < emulator.r.length; x++) {
        stackdump += hexFormat(emulator.r[x]) + getLabel(emulator.r[x]) + "<br>";
    }

    var dbg = emulator.metadata.dbginfo;

    // scan backwards & forwards in memory as long as addrs map to nearby lines
    var pcline = dbg.locs[emulator.pc];
    var memlo = emulator.pc, memhi = emulator.pc;
    while (dbg.locs[memlo - 1] > pcline - 8) memlo--;
    while (dbg.locs[memhi + 1] < pcline + 8) memhi++;

    var ind = memlo;
    stackdump += '<br><table class="debugger"><tr><td>addr</td><td>data</td><td style="width:40em">source</td></tr>\n';
    for (var line = dbg.locs[memlo]; line <= dbg.locs[memhi]; line++) {
        if (dbg.lines[line].match(/^\s*$/)) continue;  // skip empty lines
        if (dbg.locs[ind] == line) {
            stackdump += dbg.locs[ind] == pcline ? '<tr class="debugger-searchline">' : '<tr>';
            stackdump += "<td>" + hexFormat(ind).slice(2) + "</td><td>";
            for (; dbg.locs[ind] == line; ind++)
                stackdump += hexFormat(emulator.m[ind]).slice(2);
            stackdump += "</td>";
        } else {
            stackdump += "<tr><td></td><td></td>"
        }
        stackdump += "<td><pre>" + escapeHtml(dbg.lines[line]) + "</pre></td></tr>\n";
    }

    regs.innerHTML = regdump;
    stack.innerHTML = stackdump;
    emulator.breakpoint = true;
    curBreakName = breakName;
}

function clearBreakpoint() {
    var button  = document.getElementById("continueButton");
    var regs    = document.getElementById("registerView");
    var stack   = document.getElementById("stacktraceView");
    button.style.display = "none";
    regs.style.display = "none";
    stack.style.display = "none";
    emulator.breakpoint = false;
    curBreakName = undefined;
}

////////////////////////////////////
//
//   Decompiler
//
////////////////////////////////////

function setMaskFormatOverride() {
    var check = document.getElementById("maskOverride");
    emulator.maskFormatOverride = check.checked;
}

function setNumericFormat() {
    var val = document.getElementById("numericFormat").value;
    emulator.numericFormatStr = val.length < 1 ? "default"  : val;
}

function toggleBinaryTools() {
    var tools = document.getElementById("bintools");
    if (tools.style.display == "none") {
        tools.style.display = "inline";
        // document.getElementById("options").style.display = "none";
        document.getElementById("spriteEditor").style.display = "none";
        document.getElementById("audiotools").style.display = "none";
        document.getElementById("keypad").style.display = "none";
    }
    else {
        tools.style.display = "none";
    }
}

function decompileFile() {
    document.getElementById("fileinput").click();
}

function decompileRequestLoad() {
    var file = document.getElementById("fileinput").files[0];
    var reader = new FileReader();

    function actuallyLoad() {
        var buff = reader.result;
        var bytes = new Uint8Array(buff);
        var disp = "";
        if (bytes.length > 0) {
            disp = hexFormat(bytes[0]);
        }
        for(var z = 1; z < bytes.length; z++) {
            disp += ", " + hexFormat(bytes[z]);
        }
        document.getElementById("decompileInput").value = "[" + disp + "]";
        document.getElementById("copiedText").style.display = "none";
    }

    reader.onload = actuallyLoad;
    reader.readAsArrayBuffer(file);
}

// function getDecompileData() {
//     var inData = document.getElementById("decompileInput").value;
//     inData = inData.replace("[", "");
//     inData = inData.replace("]", "");
//     inData = inData.split(",");
//     var buffer = [];
//     for(var z = 0; z < inData.length; z++) {
//         buffer[z] = parse(inData[z].trim());
//     }
//     return buffer;
// }

// function decompileRun() {
//     var buffer = getDecompileData();
//     runRom({ rom:buffer, breakpoints:{}, aliases:{}, labels:{} });
// }

// var decompileProgramLength = 0;

// function decompileStart() {
//     document.getElementById("decompileWork").style.display = "inline";
//     var buffer = getDecompileData();
//     var quirks = {};
//     quirks['shiftQuirks'    ] = emulator.shiftQuirks;
//     quirks['loadStoreQuirks'] = emulator.loadStoreQuirks;
//     quirks['vfOrderQuirks'  ] = emulator.vfOrderQuirks;
//     quirks['jumpQuirks'     ] = emulator.jumpQuirks;
//     analyzeInit(buffer, quirks);
//     decompileProgramLength = buffer.length;
//     window.setTimeout(decompileProcess, 0);
// }

// function decompileProcess() {
//     var finished = false;
//     for(var z = 0; z < 100; z++) {
//         finished |= analyzeWork();
//         if (finished) { break; }
//     }
//     if (finished) {
//         analyzeFinish();
//         document.getElementById("input").value = "# decompiled program:\n" + formatProgram(decompileProgramLength);
//         document.getElementById("decompileWork").style.display = "none";
//     }
//     else {
//         window.setTimeout(decompileProcess, 0);
//     }
// }

////////////////////////////////////
//
//   Audio Editor UI
//
////////////////////////////////////

function toggleAudioEditor() {
	var audio = document.getElementById("audiotools");
	if (audio.style.display == "none") {
		// document.getElementById("options").style.display      = "none";
        document.getElementById("keypad").style.display = "none";
		document.getElementById("spriteEditor").style.display = "none";
		document.getElementById("bintools").style.display     = "none";
		audio.style.display = "inline";
		drawAudio();
	}
	else {
		audio.style.display = "none";
	}
}

function presetAudio() {
	document.getElementById("audioPattern").value = document.getElementById("audioPreset").value;
	audioPattern = parseAudio("audioPattern");
	drawAudio();
}

function randomAudio() {
	var ret = [];
	for(var z = 0; z < 16; z++) {
		ret[z] = Math.floor(Math.random() * 255);
	}
	audioPattern = ret;
	document.getElementById("audioPattern").value = getAudioHex(audioPattern);
	drawAudio();
}

function swapWaveforms(x, y) {
	var a = document.getElementById(x).value;
	var b = document.getElementById(y).value;
	document.getElementById(x).value = b;
	document.getElementById(y).value = a;
	parseWaveforms();
	drawAudio();
}

function shiftAudio(delta) {
	var result = [];
	for(var z = 0; z < 16; z++) {
		var b = 0;
		for(var index = 0; index < 8; index++) {
			var sourceIndex = (index + delta + (z * 8)) & 127;
			var sourceByte  = Math.floor(sourceIndex / 8);
			var sourceBit   = 7 - Math.floor(sourceIndex % 8);
			b = (b <<= 1) | ((audioPattern[sourceByte] >> sourceBit) & 1);
		}
		result[z] = b;
	}
	audioPattern = result;
	document.getElementById("audioPattern").value = getAudioHex(audioPattern);
	drawAudio();
}

function blendWaveform(func) {
	function blend(target, dyad) {
		var data = "";
		for(var z = 0; z < audioPattern.length; z++) {
			data += hexFormat(dyad(audioPattern[z], blendPattern[z]) & 0xFF) + " ";
		}
		document.getElementById(target).value = data;
	}

	if (func == 'xor') {
		blend("audioPattern", function(a, b) { return a ^ b; });
	}
	if (func == 'and') {
		blend("audioPattern", function(a, b) { return a & b; });
	}
	if (func == 'or') {
		blend("audioPattern", function(a, b) { return a | b; });
	}
	if (func == 'not') {
		blend("blendPattern", function(a, b) { return (~b); });
	}
	parseWaveforms();
	drawAudio();
}

function generateWaveform() {
	var canvas = document.getElementById("waveform");
	var h = canvas.height;
	var w = canvas.width;
	var g = canvas.getContext("2d");
	g.fillStyle = emulator.backgroundColor;
	g.fillRect(0, 0, canvas.width, canvas.height);

	// Samples are played at 4000 samples/second.
	// 128 samples is (1 seconds / 4000 * 128) = .032 seconds.
	// This also means that a full 128 bit pattern is ~ 2/60ths of a second.
	// A sine wave at N hz would be given by sin(t * N * 2Pi).

	var frequency = parseInt(document.getElementById("frequency").value);
	var cutoff    = parseInt(document.getElementById("cutoff").value);

	var word = 0;			
	var index = 0;

	for(var z = 0; z < 128; z++) {
		var t = z * (1 / 4000);                        // time in seconds
		var v = Math.sin(t * frequency * 2 * Math.PI); // sine wave
		var s = Math.floor((v + 1) * 128);             // offset and scale
		// draw some nice waveform displays
		g.fillStyle = emulator.fillColor2;
		g.fillRect(z*(w/128), h-(s*(h/256)), (w/128), s*(h/256));
		if (s >= cutoff) {
			g.fillStyle = emulator.fillColor;
			g.fillRect(z*(w/128), h-(cutoff*(h/256)), (w/128), cutoff*(h/256));
		}

		// build up a bit vector
		word = (word << 1) | ((s >= cutoff) ? 1 : 0);
		if ((z % 8) == 7) {
			generatedPattern[index++] = word;
			word = 0;
		}
	}
	document.getElementById("generatedPattern").value = getAudioHex(generatedPattern);
}

function parseAudio(id) {
	var pattern = document.getElementById(id).value;
	pattern = pattern.replace("[", "");
	pattern = pattern.replace("]", "");
	pattern = pattern.match(/\S+/g) || []
	var buffer = [];
	for(var z = 0; z < 16; z++) { buffer[z] = 0; }
	for(var z = 0; z < Math.min(pattern.length, 16); z++) {
		buffer[z] = parse(pattern[z].trim());
	}
	return buffer;
}

function parseWaveforms() {
	blendPattern = parseAudio("blendPattern");
	generatedPattern = parseAudio("generatedPattern");
	audioPattern = parseAudio("audioPattern");
}

function editAudioHex(id)
{
	var data = parseAudio(id);
	var empty = false;

	if(document.getElementById(id).value.trim() == "") {
		empty = true;
	}
	if(id == 'audioPattern') {
		audioPattern = data;
		drawAudio();
		if(empty) {
			document.getElementById(id).value =  getAudioHex(audioPattern);
		}
	} 
	if(id == 'blendPattern') {
		blendPattern = data;
		if(empty) {
			document.getElementById(id).value =  getAudioHex(blendPattern);
		}
	}
	if(id == 'generatedPattern') {
		generatedPattern = data;
		if(empty) {
			document.getElementById(id).value =  getAudioHex(generatedPattern);
		}
	}
}

function drawAudio() {
	var canvas = document.getElementById("drawAudio");
	var render = canvas.getContext("2d");
	render.fillStyle = emulator.backgroundColor;
	render.fillRect(0, 0, canvas.width, canvas.height);
	render.fillStyle = emulator.fillColor;
    
	for(var z = 0; z < 8 * 16; z++) {
		var a = Math.floor(z / 8);
		var b = 7 - Math.floor(z % 8);
		if (((audioPattern[a] >> b) & 1) == 0) { continue; }
		render.fillRect(z * 2, 0, 2, 32);
	}
}

function playAudio() {
	// initialize sound if necessary
	if (!audioSetup()) {
		document.getElementById("audioError").innerHTML = "Your browser doesn't support HTML5 Audio!";
		return;
	}

	// parse the sound length
	var soundLength = parseInt(document.getElementById("time").value);
	if (typeof soundLength != "number" || isNaN(soundLength)) {
		document.getElementById("error").innerHTML = "Invalid Duration.";
		return;
	}

	// parse the input string into a byte array, padding with zeros if necessary:
	var buffer = parseAudio("audioPattern");

	playPattern(soundLength, buffer);
}

function getAudioHex(buffer) {
	var hex = "";
	var maxBytes = 16;
	for(var z = 0; z < maxBytes; z++) {
		var digits = buffer[z].toString(16).toUpperCase();
		hex += "0x" + (digits.length == 1 ? "0"+digits : digits) + " ";
		if (z % 8 == 7) { hex += "\n"; }
	}
	return hex;
}

function dragAudio(event) {
	if (mode == 0) { return; }
	var rect = document.getElementById("drawAudio").getBoundingClientRect();
	var mx   = Math.floor((event.clientX - rect.left)/2);
	var dest = Math.floor(mx / 8);
	var src  = 128 >> (mx % 8);
	if (mode == 1) {
		audioPattern[dest] |= src; // draw
	}
	else {
		audioPattern[dest] &= ~src; // erase
	}

	document.getElementById("audioPattern").value = getAudioHex(audioPattern);
	drawAudio();
}

function releaseAudio(event)    { mode = 0; dragAudio(event); }
function pressDrawAudio(event)  { if (event.button == 2) {mode = 2;} else {mode = 1;} dragAudio(event); }

var audioPattern = [];
var blendPattern = [];
var generatedPattern = [];

function InitializeAudioEditor() {
	for(var z = 0; z < 16; z++) { 
		audioPattern[z] = 0;
		blendPattern[z] = 0;
	}
	generateWaveform();
	document.getElementById("audioPattern").value 	  =	getAudioHex(audioPattern);
	document.getElementById("blendPattern").value     =	getAudioHex(blendPattern);
	drawAudio();
}
InitializeAudioEditor();

var audioCanvas = document.getElementById("drawAudio");
audioCanvas.addEventListener("mousemove", dragAudio, false);
audioCanvas.addEventListener("mousedown", pressDrawAudio, false);
audioCanvas.addEventListener("mouseup"  , releaseAudio, false);
audioCanvas.oncontextmenu = function(event) { dragAudio(event); return false; };
audioCanvas.addEventListener("mouseout", releaseAudio, false);
