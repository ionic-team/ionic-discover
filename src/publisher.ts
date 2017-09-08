import * as os from 'os';
import * as dgram from 'dgram';
import { Netmask } from 'netmask';

const PREFIX = 'ION_DP';
const PORT = 41234;

export interface Interface {
  address: string;
  broadcast: string;
}

export class Publisher {

  running: boolean = false;
  timer?: number;
  client?: dgram.Socket;
  id: string;
  interval: number = 2000;
  path: string = '/';

  constructor(
    public namespace: string,
    public name: string,
    public port: number,
  ) {
    if (name.indexOf(':') >= 0) {
      console.warn('name should not contain ":"');
      name = name.replace(':', ' ');
    }
    this.id = String(Math.round(Math.random() * 1000000));
  }

  start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.running) {
        return;
      }
      this.running = true;

      const client = this.client = dgram.createSocket('udp4');
      client.on('listening', () => {
        client.setBroadcast(true);
        this.timer = setInterval(this.sayHello.bind(this), this.interval);
        this.sayHello();
      });
      client.bind();
    });
  }

  stop() {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    if (this.client) {
      this.client.close();
      this.client = undefined;
    }
  }

  buildMessage(ip: string): string {
    const now = Date.now();
    const message = {
      t: now,
      id: this.id,
      nspace: this.namespace,
      name: this.name,
      host: os.hostname(),
      ip: ip,
      port: this.port,
      path: this.path
    };
    return PREFIX + JSON.stringify(message);
  }

  private sayHello() {
    for (let iface of this.getInterfaces()) {
      const message = new Buffer(this.buildMessage(iface.address));

      if (this.client) {
        this.client.send(message, 0, message.length, PORT, iface.broadcast);
      }
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
