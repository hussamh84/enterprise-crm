const crypto = require("crypto");
const http = require("http");
const { EventEmitter } = require("events");
const net = require("net");
const tls = require("tls");

class CdpSocket extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
    socket.on("data", (chunk) => this._onData(chunk));
    socket.on("close", () => this.emit("close"));
    socket.on("error", (err) => this.emit("error", err));
  }

  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const len = this.buffer.readUInt16BE(0);
      if (this.buffer.length < 2 + len) break;
      const payload = this.buffer.slice(2, 2 + len).toString("utf8");
      this.buffer = this.buffer.slice(2 + len);
      const msg = JSON.parse(payload);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || "CDP error"));
        else resolve(msg.result);
      } else if (msg.method) {
        this.emit("event", msg);
      }
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    const frame = Buffer.alloc(2 + Buffer.byteLength(payload));
    frame.writeUInt16BE(Buffer.byteLength(payload), 0);
    frame.write(payload, 2);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.write(frame);
    });
  }

  close() {
    this.socket.end();
  }
}

const connectWebSocket = (url) =>
  new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isTls = parsed.protocol === "wss:";
    const port = parsed.port || (isTls ? 443 : 80);
    const key = crypto.randomBytes(16).toString("base64");
    const path = `${parsed.pathname}${parsed.search}`;
    const host = parsed.hostname;

    const socket = isTls
      ? tls.connect(port, host)
      : net.connect(port, host);

    let settled = false;
    const fail = (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };

    socket.once("error", fail);
    socket.once("connect", () => {
      socket.write(
        [
          `GET ${path} HTTP/1.1`,
          `Host: ${host}:${port}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${key}`,
          "Sec-WebSocket-Version: 13",
          "",
          "",
        ].join("\r\n")
      );
    });

    let headerBuf = Buffer.alloc(0);
    const onHeader = (chunk) => {
      headerBuf = Buffer.concat([headerBuf, chunk]);
      const end = headerBuf.indexOf("\r\n\r\n");
      if (end === -1) return;
      socket.removeListener("data", onHeader);
      const header = headerBuf.slice(0, end).toString("utf8");
      if (!header.includes(" 101 ")) {
        fail(new Error("WebSocket upgrade failed"));
        socket.destroy();
        return;
      }
      settled = true;
      const remainder = headerBuf.slice(end + 4);
      const cdp = new CdpSocket(socket);
      if (remainder.length) cdp._onData(remainder);
      resolve(cdp);
    };
    socket.on("data", onHeader);
  });

const fetchJson = (url) =>
  new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });

module.exports = {
  CdpSocket,
  connectWebSocket,
  fetchJson,
};
