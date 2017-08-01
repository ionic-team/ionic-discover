const os = require('os');
const dgram = require('dgram');
const Netmask = require('netmask').Netmask

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
    return ['ION_DP', now, this.id, this.name, iface.address, this.port].join(':');
  }

  private sayHello() {
    for (let iface of this.getInterfaces()) {
      const message = new Buffer(this.getMessage(iface));
      this.client.send(message, 0, message.length, 41234, iface.broadcast);
    }
  }

  private getInterfaces(): Interface[] {
    const ips = [];
    const interfaces: any = os.networkInterfaces();
    return Object.keys(interfaces)
      // filter ipv6 and internal interfaces
      .map(key => interfaces[key].find((i: any) => i.internal === false && i.family === 'IPv4'))
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
