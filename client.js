const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:53421')

let msg = {
    'addr' : 'HELO',
    'args' : [
        "Something",
        12,
        13.0,
        4
    ]
}

ws.on('open', function open() {
    console.log("Connected to websocket!");
    sendOsc("HELO");
});

ws.on('message', function msg(data){
    data = JSON.parse(data);
    console.log("Received:", data);
    addr = getAddr(data);
    if (addr == "HELO") {
        sendOsc("REQU");
    }
    if (addr == "TEST") {
        sendOsc("TEST");
    }
    if (addr == "SEND") {
        parseArgs(data.args);
    }

})

ws.on('close', function close() {
    console.log("Connection closed.");
})

function sendOsc(addr, args=[]) {
    let osc = {};
    osc.addr = "/" + addr;
    osc.args = args;
    ws.send(JSON.stringify(osc))
}

function getAddr(data) {
    let str = data.addr;
    return str.substr(1,4);
}

function parseArgs(args) {
    for (let i = 0; i < args.len; i++) {
        console.log("Arg piece:", args[i]);
    }
}
