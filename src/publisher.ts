const os = require('os');
const dgram = require('dgram');
const Netmask = require('netmask').Netmask

const PREFIX = 'ION_DP';
const PORT = 41234;

export interface Interface {
  address: string;
  netmask: string;
  family: string;
  mac: string;
  internal: boolean;
  broadcast: string;
}

export class Publisher {

  private running: boolean = false;
  private timer: any;
  private client: any;
  private id: number;

  constructor(
    private name: string,
    private port: number,
    private interval: number = 2000
  ) {
    if (name.indexOf(':') >= 0) {
      throw new Error('name can not contain ":"');
    }
    this.id = Math.round(Math.random() * 1000000);
  }

  start() {
    if (this.running) {
      return;
    }
    this.running = true;

    const client = this.client = dgram.createSocket("udp4");
    client.on('listening', () => {
      client.setBroadcast(true);
      this.timer = setInterval(this.sayHello.bind(this), this.interval);
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

  private getMessage(iface: Interface): string {
    const now = Date.now();
    const message = {
      t: now,
      id: this.id+'',
      name: this.name,
      host: os.hostname(),
      ip: iface.address,
      port: this.port
    };
    return PREFIX + JSON.stringify(message);
  }

  private sayHello() {
    for (let iface of this.getInterfaces()) {
      const message = new Buffer(this.getMessage(iface));
      this.client.send(message, 0, message.length, PORT, iface.broadcast);
    }
  }

  private getInterfaces(): Interface[] {
    const ips = [];
    const interfaces: any = os.networkInterfaces();
    return Object.keys(interfaces)
      // filter ipv6 and internal interfaces
      .map(key => interfaces[key].find((i: any) => i.family === 'IPv4'))
      .filter(iface => !!iface)
      .map((iface) => {
        const i = Object.assign({}, iface);
        i.broadcast = computeMulticast(iface);
        return i;
      });
  }
}

function computeMulticast(iface: Interface): string {
  const ip = iface.address + '/' + iface.netmask;
  const block = new Netmask(ip);
  return block.broadcast;
}
