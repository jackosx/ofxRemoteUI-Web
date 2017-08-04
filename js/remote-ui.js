///////////////////////////////////////////////////
//                      DOM                      //
///////////////////////////////////////////////////

var form = document.getElementById("host-form");
var hostField = document.getElementById("host-field");
var filterField = document.getElementById("filter-field");

filterField.oninput = function(e) {
    filterGroups(filterField.value);
}

form.addEventListener("submit", function(event) {
    event.preventDefault();
    document.activeElement.blur();
    var input = hostField.value;
    setupSocket(input);
});

window.onload = function() {
    var lastGoodHost = getRecentHost();
    if (lastGoodHost)
        setupSocket(lastGoodHost);
 };

// Setup autocomplete for the host field
 new autoComplete({
     selector: '#host-field',
     minChars: 0,
     delay: 200,
     cache: false,
     source: function(input, suggest){
         input = input.toLowerCase();
         var choices = getGoodHostRecords();
         suggest(choices.filter(function(entry){
             return ~entry.host.toLowerCase().indexOf(input)
         }));
     },
     renderItem: function (record, input){
        input = input.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        var re = new RegExp("(" + input.split(' ').join('|') + ")", "gi");
        return '<div class="autocomplete-suggestion" data-val="' + record.host + '">' + record.host.replace(re, "<b>$1</b>")
                + '<div class="moment-ago">'+moment(record.date).fromNow()+'</div></div>';
    }
 });

// HTML String Formatters
function iStr(str) { return "<i>" + str + "</i>" }
function bStr(str) { return "<b>" + str + "</b>" }

alertify.logPosition("bottom right");


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



function setState(newState) {
    var prevState = state;
    state = newState;
    if (state == 2) { // Connected
        successfulConnect()
    }
    else if (prevState == 1 && state > 2 ) { // failed attempt to connect
        failedConnect();
    }
    else if (state > 2  && prevState == 2) { // connection closed
        successfulDisconnect();
    }
}

function successfulConnect() {
    hostField.value = host;             // on Safari the field needs
    hostField.style.display = 'none';   // redraw or the placeholder sticks
    hostField.style.display = 'block';

    if (host == getRecentHost()) {
        alertify.success("Connected to last known host: " + bStr(host));
    }
    else {
        alertify.success("Connected to " + bStr(host));
    }
    saveGoodHost(host);
    createGUI();
}

function successfulDisconnect() {
    alertify.error(stateMap[state]);
    destroyGUI();
}

function failedConnect() {
    var recent = getRecentHost();
    if (host == getRecentHost()) {
        alertify.error("Connection to last good host failed.");
        hostField.value = "";
        eraseGoodHost(host);
    }
    else {
        alertify.error("Could not connect: " + stateMap[state]);
    }
    hostField.focus();
}

// Local Storage Helpers
function saveGoodHost(host) {
    var goodHosts = getGoodHostRecords() || [];
    goodHosts = goodHosts.filter(function(prevEntry) { return prevEntry.host != host })
    var entry = {
        "host" : host,
        "date" : new Date()
    }
    goodHosts.unshift(entry);
    localStorage.setItem('goodHosts', JSON.stringify(goodHosts));
}

function eraseGoodHost(host) {
    goodHosts = getGoodHostRecords().filter(function(prevEntry) { return prevEntry.host != host })
    localStorage.setItem('goodHosts', JSON.stringify(goodHosts));
}

// Returns list of hosts successfully connected to where entries are:
//        {
//            host: hostname,
//            date: date of last successful connection
//        }
function getGoodHostRecords() {
    var storedString = localStorage['goodHosts'];
    if (typeof storedString === 'undefined') storedString = '[]';
    var goodHosts = JSON.parse(storedString);
    return goodHosts;
}

// Returns a list of good hostnames only
function getGoodHosts() {
    return getGoodHostRecords().map(function(entry){ return entry.host });
}

// Returns the name of last host connected to
function getRecentHost() {
    return getGoodHosts()[0];
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
    var isMain = (typeof groupName === 'undefined');

    this.presetFolder = guiRef.addFolder(isMain ? "Presets" : "group presets");
    this.presetFolder.open();
    this.presetNames = [NO_SELECTION];

    this.groupName = (isMain) ? "" : groupName;
    this.sendSET = (isMain) ? sendSETP : function(pName) { sendSETp(pName, groupName) };
    this.sendSAV = (isMain) ? sendSAVP : function(pName) { sendSAVp(pName, groupName) };
    this.sendDEL = (isMain) ? sendDELP : function(pName) { sendDELp(pName, groupName) };

    //----Perform Styling that cant be done in CSS----
    var folderUL = this.presetFolder.domElement.firstChild;
    folderUL.style.display = 'flex';
    folderUL.style.flexWrap = 'wrap';

    var header = this.presetFolder.domElement.firstChild.firstChild;
    header.style.width = "100%";

    // lighter color for group preset headers
    if (!isMain) header.style.backgroundColor = "#1c1c1c";

    // Redraws the Preset folder
    this.redrawPresetFolder = function(){

        for (var i = this.presetFolder.__controllers.length - 1; i >= 0; i--) {
            this.presetFolder.__controllers[i].remove();
        }

        if (isMain) {
            this.presetFolder.add(this, "Load Code Defaults");
            this.presetFolder.add(this, "Load Last XML");
        }

        this.presetFolder.add(this, "Selected Preset", this.presetNames)
                .onFinishChange(this.sendSET);
        this.presetFolder.add(this, "Create New");

        if (this.selectedPreset() !== NO_SELECTION) {
            this.presetFolder.add(this, "Update Current");
            this.presetFolder.add(this, "Delete Current");
        }

        folderUL.childNodes.forEach(function(item){
            item.style.flexGrow = "1";
            item.style.minWidth = "60px";
            item.style.whiteSpace = "nowrap";
            item.style.textAlign = "center";
            if (item.className != "title"){
                var content = item.firstChild;
                if (item.classList.contains("function")){
                    var content = content.firstChild;
                }
                content.style.width = "calc(100% - 4px)";
            }

        })

    }

    // Function linked to a button to create a new preset and send it to the server
    this.createPreset = function() {
        var presetName;
        while (true) {
            presetName = prompt("Name this preset:", "Preset " + this.presetNames.length);
            if (this.presetNames.includes(presetName)) {
                alert("There is already a preset with this name.\nPlease choose a different one.");
            }
            else if (presetName == null || presetName == "") {
                return; // No input, cancel
            }
            else {
                break;
            }
        }
        this.presetNames.push(presetName);
        this.selectedPreset(presetName);
        this.redrawPresetFolder();
        this.sendSAV(presetName);
    }

    // To be called when the user selects a new preset from the dropdown.
    // We want to tell the server a new one was chosen
    this.updatePreset = function() {
        var selectedP = this.selectedPreset();
        if (selectedP == NO_SELECTION) {
            this.createPreset();
        }
        else {
            this.sendSAV(selectedP);
        }
    }

    this.deletePreset = function() {
        var selectedP = this.selectedPreset();
        if (selectedP == NO_SELECTION) {
            console.error("Trying to delete non-existent preset");
        }
        else {
            this.sendDEL(selectedP);
            var toErase = this.presetNames.indexOf(selectedP);
            if (toErase === -1)
                console.error("Trying to delete non-existent preset");
            else {
                this.presetNames.splice(toErase, 1);
                this.selectedPreset(NO_SELECTION);
                this.redrawPresetFolder();
            }
        }
    }


    // Properties/functions to be controlled by dat.GUI
    this["Create New"] = this.createPreset;
    this["Update Current"] = this.updatePreset;
    this["Delete Current"] = this.deletePreset;
    this["Selected Preset"] = NO_SELECTION;

    if (isMain) {
        this["Load Last XML"] = function(){sendRESX()};
        this["Load Code Defaults"] = function(){sendRESD()};
    }

    // convenient getter/setter bc of annoying key
    this.selectedPreset = function(sP) {
         if (typeof sP !== 'undefined') this["Selected Preset"] = sP;
         return this["Selected Preset"]
     };

     // -- Public Function --
     // Call to update with a new preset list
     this.gotPresetList = function(pNames) {
         if (pNames.length && pNames[0] != "NO_PRESETS_SAVED") {
             this.presetNames = [NO_SELECTION].concat(pNames);
             this.redrawPresetFolder();
         }
     }

     // Draw the GUI for the first time to finish initialization
    this.redrawPresetFolder();
}

function filterGroups(str) {
    if (!gui) return;
    var search = new RegExp("(" + str.split(' ').join('|') + ")", "gi");

    Object.keys(gui.__folders).forEach(function(name){
        if (name == 'Presets') return;
        var elt = gui.__folders[name].domElement;
        elt.style.display = name.match(search) ? 'block' : 'none';
    })
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
            control = guiRef.add(paramVals, name, paramInfo.min, paramInfo.max)//.listen();
    }
    else if (type == "INT") {
        paramVals[name] = parseInt(paramVal);
        paramInfo.min = parseInt(args[1]);
        paramInfo.max = parseInt(args[2]);
        if (isNewParam)
            control = guiRef.add(paramVals, name, paramInfo.min, paramInfo.max).step(1);
    }
    else if (type == "BOL") {
        paramVals[name] = (paramVal == 0) ? false : true; // force true or false
        if (isNewParam)
            control = guiRef.add(paramVals, name);
    }
    else if (type == "STR") {
        paramVals[name] = paramVal;
        if (isNewParam)
            control = guiRef.add(paramVals, name);
    }
    else if (type == "ENU") {
        paramVals[name] = parseInt(paramVal);
        var enumMin = parseInt(args[1]);
        var enumMax = parseInt(args[2]);
        var enumMap = {};
        for (var i = enumMin; i <= enumMax; i++) {
            var enumName = args[3 + i - enumMin];
            enumMap[enumName] = i;
        }
        paramInfo.enumMap = enumMap;
        if (isNewParam)
            control = guiRef.add(paramVals, name, paramInfo.enumMap);
    }
    else if (type == "COL") {
        paramVals[name] = [parseInt(args[0]), parseInt(args[1]), parseInt(args[2]), 1/2]//parseInt(args[3])/255]
        if (isNewParam)
            control = guiRef.addColor(paramVals, name);
    }

    if (control) {
        control.onFinishChange(function(val) {
            if (paramMetas[name].type == "ENU") val = parseInt(val);
            if (paramMetas[name].type == "BOL") val = val ? 1 : 0;
            paramMetas[name].osc.args[0] = val;
            if (paramMetas[name].type == "COL"){
                paramMetas[name].osc.args[0] = val[0];
                paramMetas[name].osc.args[1] = val[1];
                paramMetas[name].osc.args[2] = val[2];
                paramMetas[name].osc.args[3] = val[3] * 255;
            }
            socket.send(JSON.stringify(paramMetas[name].osc));
        });
    }
    if (!isNewParam) gui.updateDisplay();
}

function requestRemoteParams() { sendOSC("REQU"); }

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
        newGroup.domElement.classList.add("param-group");
        var headerStyle = newGroup.domElement.firstChild.firstChild.style;
        headerStyle.fontSize = "1.2em";
        headerStyle.height = "29px";
        headerStyle.lineHeight = "29px";
        headerStyle.textAlign = "center";
        headerStyle.marginTop = "30px";
        newGroup.open();
        newGroup.presetFolder = new PresetFolder(newGroup, name);
        newGroup.presetFolder.presetFolder.close();
        groups.unshift(newGroup);
    }
    else {
        setLocalParamViaOsc(osc, type, name);
    }
}

function gotPREL(osc) {
    console.log("PREL",osc);
    var args = osc.args;
    var groupPresets = {};

    var globalPresets = args.filter(function(pName){
        var slashPos = pName.indexOf('/');
        if (slashPos == -1)
            return true;

        var groupName = pName.substr(0, slashPos);
        if (!groupPresets[groupName]) groupPresets[groupName] = [];
        groupPresets[groupName].push(pName.substr(slashPos + 1)); // push group preset name after '/'
        return false;
    });

    presetFolder.gotPresetList(globalPresets);

    Object.keys(groupPresets).forEach(function(groupName) {
        gui.__folders[groupName].presetFolder
                .gotPresetList(groupPresets[groupName]);
    })

}

function gotSETP(osc) {
    requestRemoteParams();
    alertify.success("Loaded " + bStr(osc.args[0]));
}
function gotSETp(osc) {
    requestRemoteParams();
    alertify.success(bStr(osc.args[1])
        + " group loaded " + bStr(osc.args[0]))
}

function gotSAVP(osc) {
    // TODO
}

function gotSAVp(osc){
    // TODO
}

function gotRESX(osc) {
    alertify.success("Loaded last saved XML");
    requestRemoteParams();
}

function gotRESD(osc) {
    alertify.success("Loaded code defaults");
    requestRemoteParams();
}

function gotCIAO(osc) {
    alertify.log("Server says CIAO");
}

function gotDELP(osc) {
    alertify.error("Deleted " + bStr(osc.args[0]) + " preset")
}

function gotDELp(osc) {
    alertify.error("Deleted " + bStr(osc.args[0])
        + " from " + bStr(osc.args[1]));
}

function gotMISP(osc) {
    var listStr = osc.args.reduce(function(acc, param, i, list) {
            var bParam = bStr(param);
            acc += (i == list.length-1) ? bParam : bParam + ', '
            return acc
    }, "")
    alertify.error("Missing params: " + listStr);
}

var msgcFuncs = {
    "HELO" : gotHELO,
    "REQU" : gotREQU,
    "SEND" : gotSEND,
    "PREL" : gotPREL,
    "SETP" : gotSETP,
    "SETp" : gotSETp,
    "SAVP" : gotSAVP,
    "SAVp" : gotSAVp,
    "MISP" : gotMISP,
    "DELP" : gotDELP,
    "RESX" : gotRESX,
    "RESD" : gotRESD,
    "DELp" : gotDELp,
    "TEST" : gotTEST,
    "CIAO" : gotCIAO
}


// Save a global preset
function sendSAVP(newName) {
    sendOSC("SAVP",[newName]);
}

// Save a group preset
function sendSAVp(pName, groupName) {
    sendOSC("SAVp", [pName, groupName]);
}

// Set a global preset
function sendSETP(pName) {
    sendOSC("SETP", [pName]);
}

function sendDELP(pName) {
    sendOSC("DELP", [pName]);
}

// Set a group preset
function sendSETp(pName, groupName) {
    sendOSC("SETp", [pName, groupName]);
}

function sendDELp(pName, groupName) {
    sendOSC("DELp", [pName, groupName]);
}

function sendRESD() {
    sendOSC("RESD");
}

function sendRESX() {
    sendOSC("RESX");
}
