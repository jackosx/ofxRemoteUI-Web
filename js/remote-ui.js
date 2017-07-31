///////////////////////////////////////////////////
//                     DOM                       //
///////////////////////////////////////////////////

var form = document.getElementById("host-form");
var hostField = document.getElementById("host-field");
var statusLabel = document.getElementById("status-label");
form.addEventListener("submit", function(event) {
    event.preventDefault();
    document.activeElement.blur();
    var input = hostField.value;
    setupSocket(input);
});

function setState(newState) {
    state = newState;
    statusLabel.innerHTML = stateMap[state];
    if (state == 2)
        createGUI();
    if (state > 2) {
        destroyGUI();
    }
}


///////////////////////////////////////////////////
//                  WebSocket                    //
///////////////////////////////////////////////////

var socket;
var host;
var state;
var stateMap = {
    0 : "Not Connected.",
    1 : "Connecting.",
    2 : "Connected.",
    3 : "Error Connecting.",
    4 : "Socket Closed."
};
setState(0);

function setupSocket(tryhost){

    setState(1);

    host = tryhost;
    socket = new WebSocket("ws://" + host);

    socket.onopen = function(event) {
        console.log("Connected to server.");
        setState(2);
        sendOSC("HELO");
    };

    socket.onmessage = function(event) {
        console.log('Received Message:', event.data);
        var osc = JSON.parse(event.data);
        console.log(osc);
        var msgAction = getOscAddr(osc);
        var msgFnc = msgcFuncs[msgAction];
        msgFnc(osc);
    };

    socket.onclose = function(event) {
        console.log("Socket Closed.", event);
        setState(4);
    };

    socket.onerror = function(event) {
        console.log("Socket Error.");
        setState(3);
    };
}


///////////////////////////////////////////////////
//                   Dat.GUI                     //
///////////////////////////////////////////////////
var paramVals  = {}; // need to store these
var paramMetas = {}; // separately for dat.GUI
var groups = [];

var guiContainer = document.getElementById('controls');
var placeholderControls = document.getElementById('controls-placeholder');
var gui;

function createGUI() {
   placeholderControls.style.display = 'none';
   gui = new dat.GUI({ autoPlace: false, width: guiContainer.offsetWidth });
   window.addEventListener("resize", function() {
       gui.width = guiContainer.offsetWidth;
   })
   guiContainer.appendChild(gui.domElement);
}



function destroyGUI(){
    if (gui) {
        gui.destroy();
        guiContainer.removeChild(gui.domElement);
    }
    paramVals = {};
    paramMetas = {};
    groups = [];
    placeholderControls.style.display = 'block';
}


///////////////////////////////////////////////////
//                Quasi-Osc Things               //
///////////////////////////////////////////////////

function createOsc(addr, args) {
    return {
        "addr": "/" + addr,
        "args": args
    };
}

function sendOSC(addr, args) {
    socket.send(JSON.stringify(createOsc(addr, args)));
}

function getOscAddr(osc) {
    return osc.addr.substr(1,4);
}

function getHeaderPieces(osc) {
    return osc.addr.split(' ');
}

// Update the values here in JS
function setLocalParamViaOsc(osc, type, name) {

    if (typeof type === 'undefined') type = getHeaderPieces(osc)[1];
    if (typeof name === 'undefined') name = getHeaderPieces(osc)[2];

    var args = osc.args;
    var paramVal = args[0];
    var paramInfo = { "type" : type, "osc" : osc  };
    var guiRef = (groups.length > 0) ? groups[0] : gui;
    var control; // used to listen for value changes
    var isNewParam = !(paramVals.hasOwnProperty(name));

    paramMetas[name] = paramInfo;

    if (type == "FLT") {
        paramVals[name] = parseFloat(paramVal);
        paramInfo.min = parseFloat(args[1]);
        paramInfo.max = parseFloat(args[2]);
        if (isNewParam)
            control = guiRef.add(paramVals, name, paramInfo.min, paramInfo.max).listen();
    }
    else if (type == "INT") {
        paramVals[name] = parseInt(paramVal);
        paramInfo.min = parseInt(args[1]);
        paramInfo.max = parseInt(args[2]);
        if (isNewParam)
            control = guiRef.add(paramVal, name, paramInfo.min, paramInfo.max).step(1);
    }
    else if (type == "BOL") {
        paramVals[name] = parseBool(paramVal);
        guiRef.add
    }
    else if (type == "STR") {

    }
    else if (type == "ENU") {

    }
    else if (type == "COL") {

    }

    control.onFinishChange(function(val) {
        paramMetas[name].osc.args[0] = val;
        socket.send(JSON.stringify(paramMetas[name].osc));
    });

}

function receviedParam(data) {}

/* Possible osc addresses: (see ofxRemoteUI.h)
HELO    –   In Response to client HELO
REQU    –   'REQU OK' indicates end of requested param lists
SEND    –   Followed by a param
PREL    –   Preset name list
SETP    -   Followed by OK, server set preset ack
MISP    -   Missing presets
SAVP    –   Save current params as preset
DELP    -   Delete a preset
RESX    -   Reset to default XML values
RESD    –   Reset to code defaults (pre-RUI invocation)
SAVp    -   Save a preset, different from SAVP ? ? ?
DELp    -   Delete a preset, diffent from DELP ? ? ?
TEST    -   Part of ping-pong keep alive exchange
CIAO    -   Signal disconnect
*/

// Server sends HELO after we say HELO, opening connection
// Next we want to request the param list
function gotHELO(osc) {
    setInterval(function() {sendOSC("TEST")}, 500);
    sendOSC("REQU");
}

// Should receive a message like { addr : "/REQU OK"} to signal end of params
function gotREQU(osc) {
    var headerPieces = osc.addr.split(' ');
    if (headerPieces.length == 2 || headerPieces[1] == "OK") {
        // TODO Great, we got all the params
    }
    else {
        // UH-OH
    }
}

// Got TEST, keep alive
function gotTEST(osc) {
    // we'll send our own TEST separately
}

function gotSEND(osc) {
    var headerPieces = getHeaderPieces(osc);
    var type = headerPieces[1];
    if (type == "SPA") { // Its a new group
        var newGroup = gui.addFolder(headerPieces[2]);
        newGroup.open();
        // TODO Colors
        groups.unshift(newGroup);
    }
    else {
        setLocalParamViaOsc(osc, type, headerPieces[2]);
    }
}

var msgcFuncs = {
    "HELO" : gotHELO,
    "REQU" : gotREQU,
    "SEND" : gotSEND,
    /*"PREL" : gotPREL,
    "SETP" : gotSETP,
    "MISP" : gotMISP,
    "SAVP" : gotSAVP,
    "DELP" : gotDELP,
    "RESX" : gotRESX,
    "RESD" : gotRESD,
    "SAVp" : gotSAVp,
    "DELp" : gotDELp,*/
    "TEST" : gotTEST,
    // "CIAO" : gotCIAO
}
