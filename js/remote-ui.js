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
        var osc = JSON.parse(event.data);
        var msgAction = getOscAddr(osc);

        if (msgAction != "TEST") {
            console.log("Received:", osc)
        }

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
var groups = [];     // list of dat.gui folders for param groups
var presetFolder;


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
   presetFolder = new PresetFolder(gui);
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
//                    Presets                    //
///////////////////////////////////////////////////

function PresetFolder(guiRef, groupName) {
    var NO_SELECTION = "No Preset Selected";
    this.presetFolder = guiRef.addFolder("Presets");
    this.presetFolder.open();
    this.presetNames = [NO_SELECTION];

    this.groupName = (typeof type === 'undefined') ? "" : groupName;
    this.sendSET = (this.groupName.length == 0) ? sendSETP
                        : function(pName) { sendSETp(pName, this.groupName) };

    this.sendSAV = (this.groupName.length == 0) ? sendSAVP
                        : function(pName) { sendSAVp(pName, this.groupName) };

    // adds the elements to the preset selection folder
    this.updatePresetGUIFolder = function(){
        for (var i = this.presetFolder.__controllers.length - 1; i >= 0; i--) {
            console.log("Removing controller "+ i);
            this.presetFolder.__controllers[i].remove();
        }
        this.presetFolder.add(this, "Selected Preset", this.presetNames)
                .onFinishChange(this.sendSET);
        this.presetFolder.add(this, "Create");
        this.presetFolder.add(this, "Update Current");
    }

    this.createPreset = function() {
        var presetName;
        while (true) {
            presetName = prompt("Name this preset:", "Preset " + this.presetNames.length);
            if (this.presetNames.includes(presetName)) {
                alert("There is already a preset with this name.\nPlease choose a different one.");
            }
            else if (presetName == null || presetName == "") {
                return;
            }
            else {
                break;
            }
        }
        this.presetNames.push(presetName);
        this.selectedPreset(presetName);
        this.updatePresetGUIFolder();
        this.sendSAV(presetName);
    }

    // To be called when the user selects a new preset from the dropdown.
    // We want to tell the server a new one was chosen
    this.updatePreset = function() {
        var selectedP = this.selectedPreset();
        if (selectedP == NO_SELECTION) {
            createPreset();
        }
        else {
            sendSAVP(selectedP);
        }
    }


    // Properties/functions to be controlled by dat.GUI
    this["Create"] = this.createPreset;
    this["Update Current"]  = this.updatePreset;
    this["Selected Preset"] = NO_SELECTION;

    // convenient getter/setter bc of annoying key
    this.selectedPreset = function(sP) {
         if (typeof sP !== 'undefined') this["Selected Preset"] = sP;
         return this["Selected Preset"]
     };

     this.gotPresetList = function(pNames) {
         if (pNames.length && pNames[0] != "NO_PRESETS_SAVED") {
             this.presetNames = [NO_SELECTION].concat(pNames);
             this.updatePresetGUIFolder();
         }
     }

    this.updatePresetGUIFolder();
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

    if (control) {
        control.onFinishChange(function(val) {
            paramMetas[name].osc.args[0] = val;
            socket.send(JSON.stringify(paramMetas[name].osc));
        });
    }
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
    var name = headerPieces[2];
    if (type == "SPA" && !gui.__folders[name]) { // Its a new group
        var newGroup = gui.addFolder(name);
        newGroup.open();
        // TODO Colors
        groups.unshift(newGroup);
    }
    else {
        setLocalParamViaOsc(osc, type, name);
    }
}

function gotPREL(osc) {
    console.log("PREL",osc);
    var args = osc.args;
    presetFolder.gotPresetList(args);
}

function gotSETP(osc) {
    sendOSC("REQU");
}

var msgcFuncs = {
    "HELO" : gotHELO,
    "REQU" : gotREQU,
    "SEND" : gotSEND,
    "PREL" : gotPREL,
    "SETP" : gotSETP,
    /*"MISP" : gotMISP,
    "SAVP" : gotSAVP,
    "DELP" : gotDELP,
    "RESX" : gotRESX,
    "RESD" : gotRESD,
    "SAVp" : gotSAVp,
    "DELp" : gotDELp,*/
    "TEST" : gotTEST,
    // "CIAO" : gotCIAO
}


function sendSAVP(newName) {
    sendOSC("SAVP",[newName]);
}

function sendSETP(pName) {
    sendOSC("SETP", [pName]);
}

function sendSETp(pName, groupName) {
    sendOSC("SETp", [pName, groupName]);
}

function sendSAVp(pName, groupName) {
    sendOSC("SAVp", [pName, groupName]);
}
