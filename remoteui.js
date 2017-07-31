var socket = new WebSocket("ws://localhost:53421");

socket.addEventListener('open', function open() {
    console.log("Connected to websocket!");
    sendOsc("HELO");
});

socket.addEventListener('message', function msg(event){
    data = JSON.parse(event.data);
    console.log("Received:", data);
    addr = getAddr(data);
    if (addr == "HELO") {
        sendOsc("REQU");
    }
    if (addr == "TEST") {
        sendOsc("TEST");
    }
    if (addr == "SEND") {
        var cmd = parseSEND(data);
        addToGUI(cmd);
    }

})

socket.addEventListener('close', function close() {
    console.log("Connection closed.");
})

function sendOsc(addr, args=[]) {
    let osc = {};
    osc.addr = "/" + addr;
    osc.args = args;
    socket.send(JSON.stringify(osc))
}

function getAddr(data) {
    let str = data.addr;
    return str.substr(1,4);
}

function parseSEND(data) {
    var headerPieces = data.addr.split(' ');
    args = data.args;
    var newData = {
        'type' : headerPieces[1],
        'name' : headerPieces[2],
        'color': {
            'r': args[args.len - 3],
            'g': args[args.len - 2],
            'b': args[args.len - 1]
        }
    }
    if (newData.type == "FLT") {

    }
    return newData;
}

var propertyCollector = {};
var gui = new dat.GUI();
var curFolder;

function addToGUI(cmd) {
    if (cmd.type == "SPA") {
        curFolder = gui.addFolder(cmd.name);
    }
    else {
        propertyCollector[cmd.name] = 0;
        if (curFolder) {
            curFolder.add(propertyCollector, cmd.name, -1, 1);
        }
        else {
            gui.add(propertyCollector, cmd.name, -1, 1);
        }
    }
}
