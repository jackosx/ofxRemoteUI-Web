
///////////////////////////////////////////////////
//                  WebSocket                    //
///////////////////////////////////////////////////

var socket = new WebSocket("ws://localhost:1234");

socket.addEventListener('open', function(event) {
  console.log("Connected to server.");
});

socket.addEventListener('message', function(event) {
  console.log('Received Message:', event.data);
  var osc = JSON.parse(event.data);
  gotMsg[getOscAddr(osc)];
})



///////////////////////////////////////////////////
//                Quasi-Osc Things               //
///////////////////////////////////////////////////

var paramVals  = {}; // need to store these
var paramMetas = {}; // separately for dat.GUI
var groups = [];

function createOsc(addr, args) {
  return {
            "addr": "/" + addr,
            "args": args
         };
}

function getOscAddr(osc) {
  return osc.addr.substr(1,4);
}

function getHeaderPieces(osc) {
  return osc.addr.split(' ');
}

function setParam(data) {}

function setParamViaOsc(osc, type, name) {

  if (typeof type === 'undefined') type = getHeaderPieces(osc)[1];
  if (typeof name === 'undefined') name = getHeaderPieces(osc)[2];

  var args = osc.args;
  var paramVal = 1;
  var paramInfo = {};

  if (type == "FLT") {

  }
  else if (type == "INT") {

  }
  else if (type == "BOL") {

  }
  else if (type == "STR") {

  }
  else if (type == "ENU") {

  }
  else if (type == "COL") {

  }


  if (!(paramVals.hasOwnProperty(name))) {
    paramVals[name] = paramVal;
    var guiT = (groups.len > 0) ? groups[0] : gui;
    guiT.add(paramVals, name);
  }
  else {
    paramVals[name] = paramVal;
  }

  paramMetas[name] = paramInfo;


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
  sendOSC("REQU");
}

// Should receive a message like { addr : "/REQU OK"} to signal end of params
function gotREQU(osc) {
  var headerPieces = msg.addr.split(' ');
  if (headerPieces.len == 2 || headerPieces[1] == "OK") {
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
    var newGroup = new gui.addFolder(headerPieces[2]);
    // TODO Colors
    groups.unshift(newGroup);
  }
  else {
    gotParamViaOsc(osc)
  }
}

var gotMsg = {
  "HELO" : gotHELO,
  "REQU" : gotREQU,
  "SEND" : gotSEND,
/*  "PREL" : gotPREL,
  "SETP" : gotSETP,
  "MISP" : gotMISP,
  "SAVP" : gotSAVP,
  "DELP" : gotDELP,
  "RESX" : gotRESX,
  "RESD" : gotRESD,
  "SAVp" : gotSAVp,
  "DELp" : gotDELp,
  "TEST" : gotTEST,
  "CIAO" : gotCIAO */
}

///////////////////////////////////////////////////
//                   Dat.GUI                     //
///////////////////////////////////////////////////

var gui = new dat.GUI({ autoPlace: false });

var customContainer = document.getElementById('controls');
customContainer.appendChild(gui.domElement);
