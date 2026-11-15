import * as net from 'node:net';
import * as tls from 'node:tls';

type RespValue = string | number | null;

function encodeCommand(args: string[]): Buffer {
  const chunks: Buffer[] = [Buffer.from(`*${args.length}\r\n`, 'utf8')];
  for (const arg of args) {
    const buf = Buffer.from(arg, 'utf8');
    chunks.push(Buffer.from(`$${buf.length}\r\n`, 'utf8'), buf, Buffer.from('\r\n', 'utf8'));
  }
  return Buffer.concat(chunks);
}

function tryParseResp(buf: Buffer): { value: RespValue; bytes: number } | null {
  if (buf.length < 3) return null;
  const crlf = buf.indexOf('\r\n');
  if (crlf === -1) return null;

  const prefix = String.fromCharCode(buf[0]);
  const line = buf.subarray(1, crlf).toString('utf8');

  if (prefix === '+') return { value: line, bytes: crlf + 2 };
  if (prefix === ':') return { value: Number.parseInt(line, 10), bytes: crlf + 2 };
  if (prefix === '-') throw new Error(`redis error: ${line}`);
  if (prefix === '$') {
    const len = Number.parseInt(line, 10);
    if (len < 0) return { value: null, bytes: crlf + 2 };
    const end = crlf + 2 + len + 2;
    if (buf.length < end) return null;
    return { value: buf.subarray(crlf + 2, crlf + 2 + len).toString('utf8'), bytes: end };
  }
  throw new Error(`unexpected redis response prefix: ${prefix}`);
}

/** Execute a sequential batch of RESP2 commands over one short-lived socket. */
export async function execRedisCommands(
  redisUrl: string,
  commands: string[][],
  timeoutMs = 1500,
): Promise<RespValue[]> {
  const url = new URL(redisUrl);
  const isTls = url.protocol === 'rediss:';
  const host = url.hostname || '127.0.0.1';
  const port = url.port ? Number(url.port) : isTls ? 6380 : 6379;
  const preamble: string[][] = [];

  if (url.password) {
    const pass = decodeURIComponent(url.password);
    const user = url.username ? decodeURIComponent(url.username) : '';
    preamble.push(user ? ['AUTH', user, pass] : ['AUTH', pass]);
  }
  const dbMatch = /^\/(\d+)$/.exec(url.pathname);
  if (dbMatch && dbMatch[1] !== '0') {
    preamble.push(['SELECT', dbMatch[1]]);
  }

  const allCommands = [...preamble, ...commands];
  return new Promise<RespValue[]>((resolve, reject) => {
    const socket = isTls
      ? tls.connect({ host, port, servername: host })
      : net.createConnection({ host, port });

    const results: RespValue[] = [];
    let buffer = Buffer.alloc(0);
    let settled = false;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve(results.slice(preamble.length));
    };

    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => finish(new Error('redis command timed out')));
    socket.on('error', (err) => finish(err));

    socket.on('connect', () => {
      const payload = Buffer.concat(allCommands.map(encodeCommand));
      socket.write(payload);
    });

    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        while (results.length < allCommands.length) {
          const parsed = tryParseResp(buffer);
          if (!parsed) break;
          results.push(parsed.value);
          buffer = buffer.subarray(parsed.bytes);
        }
        if (results.length === allCommands.length) {
          finish();
        }
      } catch (err) {
        finish(err instanceof Error ? err : new Error('redis parse failure'));
      }
    });
  });
}

