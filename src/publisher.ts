const os = require('os');
const dgram = require('dgram');
const Netmask = require('netmask').Netmask

const PREFIX = 'ION_DP';
const PORT = 41234;

export interface Interface {
  address: string;
  broadcast: string;
}

export class Publisher {

  running: boolean = false;
  timer: any = null;
  client: any = null;
  id: string;

  constructor(
    public namespace: string,
    public name: string,
    public port: number,
    public interval: number = 2000
  ) {
    if (name.indexOf(':') >= 0) {
      throw new Error('name can not contain ":"');
    }
    this.id = Math.round(Math.random() * 1000000) + '';
  }

  start(callback?: Function) {
    if (this.running) {
      return;
    }
    this.running = true;

    const client = this.client = dgram.createSocket("udp4");
    client.on('listening', () => {
      client.setBroadcast(true);
      this.timer = setInterval(this.sayHello.bind(this), this.interval);
      this.sayHello();
      callback && callback();
    });
    client.bind();
  }

  stop() {
    if (!this.running) {
      return;
    }
    this.running = false;

    clearInterval(this.timer);
    this.timer = null;
    this.client.close();
    this.client = null;
  }

  buildMessage(address: string): string {
    const now = Date.now();
    const message = {
      t: now,
      id: this.id,
      nspace: this.namespace,
      name: this.name,
      host: os.hostname(),
      ip: address,
      port: this.port
    };
    return PREFIX + JSON.stringify(message);
  }

  private sayHello() {
    for (let iface of this.getInterfaces()) {
      const message = new Buffer(this.buildMessage(iface.address));
      this.client.send(message, 0, message.length, PORT, iface.broadcast);
    }
  }

  private getInterfaces(): Interface[] {
    return prepareInterfaces(os.networkInterfaces());
  }
}

export function prepareInterfaces(interfaces: any): Interface[] {
  const set = new Set<string>();
  return Object.keys(interfaces)
    .map(key => interfaces[key] as any[])
    .reduce((prev, current) => prev.concat(current))
    .filter(iface => iface.family === 'IPv4')
    .map(iface => {
      return {
        address: iface.address,
        broadcast: computeMulticast(iface.address, iface.netmask),
      };
    })
    .filter(iface => {
      if (!set.has(iface.broadcast)) {
        set.add(iface.broadcast);
        return true;
      }
      return false;
    });
}

function computeMulticast(address: string, netmask: string): string {
  const ip = address + '/' + netmask;
  const block = new Netmask(ip);
  return block.broadcast;
}
