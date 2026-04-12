import net from 'net';

interface FTPUploadOptions {
  host: string;
  port: number;
  username: string;
  password: string;
  remotePath: string;
  content: Buffer;
}

function readReply(socket: net.Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    const onData = (chunk: Buffer) => {
      data += chunk.toString('utf-8');
      const lines = data.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || '';
      if (/^\d{3}\s/.test(last)) {
        socket.off('data', onData);
        socket.off('error', reject);
        resolve(data);
      }
    };
    socket.on('data', onData);
    socket.once('error', reject);
  });
}

async function sendCommand(socket: net.Socket, command: string, okCodes: string[]): Promise<string> {
  socket.write(`${command}\r\n`);
  const reply = await readReply(socket);
  const code = reply.slice(0, 3);
  if (!okCodes.includes(code)) {
    throw new Error(`FTP ${command} failed: ${reply.trim()}`);
  }
  return reply;
}

function connectSocket(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => resolve(socket));
    socket.setTimeout(30000);
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error('FTP connection timeout'));
    });
    socket.once('error', reject);
  });
}

function parsePassive(reply: string): { host: string; port: number } {
  const match = reply.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
  if (!match) throw new Error(`FTP passive reply is invalid: ${reply.trim()}`);
  const [, a, b, c, d, p1, p2] = match;
  return {
    host: `${a}.${b}.${c}.${d}`,
    port: Number(p1) * 256 + Number(p2),
  };
}

export async function uploadFTP(options: FTPUploadOptions): Promise<void> {
  const control = await connectSocket(options.host, options.port);
  try {
    const hello = await readReply(control);
    if (!hello.startsWith('220')) throw new Error(`FTP greeting failed: ${hello.trim()}`);

    const userReply = await sendCommand(control, `USER ${options.username}`, ['230', '331']);
    if (!userReply.startsWith('230')) {
      await sendCommand(control, `PASS ${options.password}`, ['230']);
    }
    await sendCommand(control, 'TYPE I', ['200']);
    const pasv = await sendCommand(control, 'PASV', ['227']);
    const dataTarget = parsePassive(pasv);
    const dataSocket = await connectSocket(dataTarget.host, dataTarget.port);

    const storPromise = readReply(control);
    control.write(`STOR ${options.remotePath}\r\n`);
    const preStoreReply = await storPromise;
    if (!preStoreReply.startsWith('150') && !preStoreReply.startsWith('125')) {
      dataSocket.destroy();
      throw new Error(`FTP STOR failed: ${preStoreReply.trim()}`);
    }

    await new Promise<void>((resolve, reject) => {
      dataSocket.once('error', reject);
      dataSocket.end(options.content, () => resolve());
    });
    const complete = await readReply(control);
    if (!complete.startsWith('226') && !complete.startsWith('250')) {
      throw new Error(`FTP upload did not complete: ${complete.trim()}`);
    }
    await sendCommand(control, 'QUIT', ['221']);
  } finally {
    control.destroy();
  }
}
