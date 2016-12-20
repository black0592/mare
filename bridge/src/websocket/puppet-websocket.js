import EventEmitter from 'events';
import * as msgpack from 'msgpack-lite';
import WebSocket from 'ws';
import liburl from 'url';

const PACK_HEAD_LEN = 4;

const trimHeartbeatBytes = (data) => {
    let i;
    for (i = 0; i < data.length; i++) {
        const num = data.readUInt8(i);
        if (num !== 0) {
            break;
        }
    }
    return data.slice(i);
};

const parseCommand = (data) => {
    data = trimHeartbeatBytes(data);

    let command = null;
    if (data.length <= PACK_HEAD_LEN) {
        return {command, chunk: data};
    }

    const pack_length = data.readUIntLE(0, PACK_HEAD_LEN);
    if (data.length < (PACK_HEAD_LEN + pack_length)) {
        return {command, chunk: data};
    }

    const pack_data = data.slice(PACK_HEAD_LEN, PACK_HEAD_LEN + pack_length);
    const chunk = data.slice(PACK_HEAD_LEN + pack_length);
    command = msgpack.decode(pack_data);
    return {command, chunk};
};

const parseCommands = (data) => {
    const commands = [];
    let chunk = data;
    while (true) {
        const result = parseCommand(chunk);
        chunk = result.chunk;
        if (result.command === null) {
            break;
        }
        commands.push(result.command);
    }
    return {commands, chunk};
};

export class PuppetWebSocket extends EventEmitter {

    constructor(socket) {
        super();
        this.socket = socket;
        this.handshaked = false;
        this.chunk = Buffer.alloc(0);
        this.upgradeReq = null;
        this.readyState = WebSocket.OPEN;
        this.initSocketListeners();
    }

    initSocketListeners() {
        this.socket.on('data', this.onSocketData);
        this.socket.on('close', this.onSocketClose);
        this.socket.on('error', this.onSocketError);
    }

    feed(newData) {
        const data = Buffer.concat([this.chunk, newData]);
        const {commands, chunk} = parseCommands(data);
        this.chunk = chunk;
        if (commands.length === 0) {
            return;
        }

        for (const command of commands) {
            const [type, data] = command;
            if (type === 'handshake') {
                this.doHandShake(data);
                continue;
            }
            if (type === 'message') {
                if (this.handshaked) {
                    this.emit('message', data);
                }
                continue;
            }
            console.warn('ignore command', command);
        }
    }

    doHandShake(url) {
        const location = liburl.parse(url.trim(), true);
        this.upgradeReq = {
            url: location.href,
        };
        this.handshaked = true;
        this.emit('handshake');
    }

    onSocketData = (data) => {
        //const dataString = data.toString();
        //console.log('data', dataString);
        //console.log('data', data);
        this.feed(data);
    }

    onSocketClose = (hadError) =>  {
        const code = hadError ? 1001 : 1000;
        this.readyState = WebSocket.CLOSED;
        this.emit('close', code, '');
    }

    onSocketError = (error) => {
        this.emit('error', error);
    }

    close() {
        if (this.readyState === WebSocket.CLOSED) {
            return;
        }
        if (this.socket.destroyed) {
            return;
        }
        this.socket.destroy();
        this.readyState = WebSocket.CLOSED;
    }

    send(data) {
        this.socket.send(data);
    }

}