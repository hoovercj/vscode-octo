"use strict";

////////////////////////////////////
//
//   Emulator Execution
//
////////////////////////////////////

// var scaleFactor = 5;
var renderTarget = "target";

function unpackOptions(emulator, options) {
    var flags = [
        "tickrate",
        "fillColor",
        "fillColor2",
        "blendColor",
        "backgroundColor",
        "buzzColor",
        "quietColor",
        "shiftQuirks",
        "loadStoreQuirks",
        "vfOrderQuirks",
        "clipQuirks",
        "jumpQuirks",
        "enableXO",
        "screenRotation",
    ]
    for (var x = 0; x < flags.length; x++) {
        var flag = flags[x];
        if (options[flag]) { emulator[flag] = options[flag]; }
    }
}

function setRenderTarget(canvasId) {
    renderTarget = canvasId;
    var canvas = document.getElementById(canvasId);

    // Remove any existing previous delta frame so first frame is always drawn:
    canvas.last = undefined;

    // var w  = scaleFactor * 128;
    // var h  = scaleFactor *  64;
    // var wm = (scaleFactor * -64) + "px";
    // var hm = (scaleFactor * -32) + "px";

    // if (emulator.screenRotation == 90 || emulator.screenRotation == 270) {
    // 	c.width  = h;
    // 	c.height = w;
    // 	c.style.marginLeft = hm;
    // 	c.style.marginTop  = wm;
    // }
    // else {
    // 	c.width  = w;
    // 	c.height = h;
    // 	c.style.marginLeft = wm;
    // 	c.style.marginTop  = hm;
    // }
}

// function getTransform(emulator, canvas) {
//     var canvasContext = canvas.getContext("2d");
//     var stride = emulator.hires ? 128 : 64;
//     var scaleFactor = Math.max(canvas.width, canvas.height) / stride;
//     canvasContext.setTransform(1, 0, 0, 1, 0, 0);
//     var x = scaleFactor * 128;
//     var y = scaleFactor *  64;
//     emulator.screenRotation = 90;
//     switch(emulator.screenRotation) {
//         case 90:
//             canvasContext.rotate(0.5 * Math.PI);
//             canvasContext.translate(0, -y);
//             break;
//         case 180:
//             canvasContext.rotate(1.0 * Math.PI);
//             canvasContext.translate(-x, -y);
//             break;
//         case 270:
//             canvasContext.rotate(1.5 * Math.PI);
//             canvasContext.translate(-x, 0);
//             break;
//         default:
//             /* nothing to do */
//     }
// }

function getTransform(emulator, canvas) {
    if (emulator.screenRotation === 0) {
        return;
    }

    var canvasContext = canvas.getContext("2d");
    canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    var width = canvas.width;
    var height = canvas.height;
    // translate to center-canvas 
    // the origin [0,0] is now center-canvas
    canvasContext.translate(width/2,height/2);
    switch(emulator.screenRotation) {
        case 90:
            canvasContext.rotate(Math.PI/2);
            canvasContext.transform(.5, 0, 0, 2, 0, 0);
            break;
        case 180:
            canvasContext.rotate(1.0 * Math.PI);
            canvasContext.transform(1,0,0,1,0,0);
            break;
        case 270:
            canvasContext.rotate(1.5 * Math.PI);
            canvasContext.transform(.5, 0, 0, 2, 0, 0);
            break;
        default:
            /* nothing to do */
            break;
    }
    canvasContext.translate(-width / 2, -height / 2);
}

function arrayEqual(a, b) {
    var length = a.length;
    if (length !== b.length) { return false; }
    for (var i = 0; i < length; i++) {
        if (a[i] !== b[i]) { return false; }
    }
    return true;
}

function getColor(id) {
    switch(id) {
        case 0: return emulator.backgroundColor;
        case 1: return emulator.fillColor;
        case 2: return emulator.fillColor2;
        case 3: return emulator.blendColor;
    }
    throw "invalid color: " + id;
}

function renderDisplay(emulator) {
    var canvas = document.getElementById(renderTarget);

    // Canvas rendering can be expensive. Exit out early if nothing has changed.
    // NOTE: toggling emulator.hires changes emulator.p dimensions.
    var colors = [emulator.backColor, emulator.fillColor, emulator.fillColor2, emulator.blendColor];
    if (canvas.last !== undefined
            && arrayEqual(canvas.last.p[0], emulator.p[0]) && arrayEqual(canvas.last.p[1], emulator.p[1])
            && arrayEqual(canvas.last.colors, colors)) {
        return;
    }
    canvas.last = {
        colors: colors,
        p: [emulator.p[0].slice(), emulator.p[1].slice()]
    };
    // getTransform(emulator, canvas);
    var canvasContext = canvas.getContext("2d");
    canvasContext.fillStyle = emulator.backgroundColor;
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);
    var max    = emulator.hires ? 128*64      : 64*32;
    var stride = emulator.hires ? 128         : 64;
    var scaleFactor = Math.max(canvas.width, canvas.height) / stride;

    for(var z = 0; z < max; z++) {
        var color = getColor(emulator.p[0][z] + (emulator.p[1][z] * 2));
        if (color == emulator.backColor) {
            continue;  // it's pointless to draw the background color
        }
        canvasContext.fillStyle = color;
        canvasContext.fillRect(
            Math.floor(z%stride)*scaleFactor,
            Math.floor(z/stride)*scaleFactor,
            scaleFactor, scaleFactor
        );
    }
}

////////////////////////////////////
//
//   Audio Playback
//
////////////////////////////////////

var audio;
var audioNode;
var audioSource;
var audioData;

var AudioBuffer = function(buffer, duration) {
    if (!(this instanceof AudioBuffer)) {
        return new AudioBuffer(buffer, duration);
    }

    this.pointer = 0;
    this.buffer = buffer;
    this.duration = duration;
}

AudioBuffer.prototype.write = function(buffer, index, size) {
    size = Math.max(0, Math.min(size, this.duration))
    if (!size) { return size; }

    this.duration -= size;
    var bufferSize = this.buffer.length;
    var end = index + size;

    for(var i = index; i < end; ++i) {
        buffer[i] = this.buffer[this.pointer++];
        this.pointer %= bufferSize;
    }

    return size;
}

AudioBuffer.prototype.dequeue = function(duration) {
    this.duration -= duration;
}

var FREQ = 4000;
var TIMER_FREQ = 60;
var SAMPLES = 16;
var BUFFER_SIZE = SAMPLES * 8

function audioSetup() {
    if (!audio) {
        if (typeof AudioContext !== 'undefined') {
            audio = new AudioContext();
        }
        else if (typeof webkitAudioContext !== 'undefined') {
            audio = new webkitAudioContext();
        }
    }
    if (audio && !audioNode) {
        audioNode = audio.createScriptProcessor(4096, 1, 1);
        audioNode.onaudioprocess = function(audioProcessingEvent) {
            var outputBuffer = audioProcessingEvent.outputBuffer;
            var outputData = outputBuffer.getChannelData(0);
            var samples_n = outputBuffer.length;

            var index = 0;
            while(audioData.length && index < samples_n) {
                var size = samples_n - index;
                var written = audioData[0].write(outputData, index, size);
                index += written;
                if (written < size) {
                    audioData.shift();
                }
            }

            while(index < samples_n) {
                outputData[index++] = 0;
            }
        }
        audioData = [];
        audioNode.connect(audio.destination);
        return true;
    }
    if (audio && audioNode) { return true; }
    return false;
}

function stopAudio() {
    if (!audio) { return; }
    if (audioNode) {
        audioNode.disconnect();
        audioNode = null;
    }
    audioData = [];
}

var VOLUME = 0.25;

function playPattern(soundLength, buffer, remainingTicks) {
    if (!audio) { return; }

    var samples = Math.floor(BUFFER_SIZE * audio.sampleRate / FREQ);
    var audioBuffer = new Array(samples);
    if (remainingTicks && audioData.length > 0) {
        audioData[audioData.length - 1].dequeue(Math.floor(remainingTicks * audio.sampleRate / TIMER_FREQ));
    }

    for(var i = 0; i < samples; ++i) {
        var srcIndex = Math.floor(i * FREQ / audio.sampleRate);
        var cell = srcIndex >> 3;
        var bit = srcIndex & 7;
        audioBuffer[i] = (buffer[srcIndex >> 3] & (0x80 >> bit)) ? VOLUME: 0;
    }
    audioData.push(new AudioBuffer(audioBuffer, Math.floor(soundLength * audio.sampleRate / TIMER_FREQ)));
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function copyHex() {
    var input = document.getElementById('decompileInput');
    input.select();
    document.execCommand('copy');
    document.getElementById('copiedText').style.display = 'inline';
}