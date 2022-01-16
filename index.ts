import process from "process";
import { URL } from "url";
import { createServer, request } from "http";
import net from "net";

interface Config {
  host: string;
  port: number;
  username?: string;
  password?: string;

  escalatorPort: number;
}

function loadConfig(): Config {
  const urlEnvKey = "ESCALATOR_HTTP_PROXY";

  const url = process.env[urlEnvKey];
  if (!url) {
    throw new Error(`environment variable ${urlEnvKey} not found`);
  }

  const parsedURL = new URL(url);

  const serverPort = Number.parseInt(process.env["ESCALATOR_PORT"] || "3101");

  return {
    host: parsedURL.hostname,
    port: Number.parseInt(parsedURL.port, 10),
    username: parsedURL.username,
    password: parsedURL.password,
    escalatorPort: serverPort,
  };
}

const config = loadConfig();

const httpServer = createServer((req, res) => {
  console.log(`${new Date().toJSON()} ${req.method} ${req.url}`);

  if (!req.url) {
    res.destroy();
    return;
  }

  const headersWithAuth = {
    ...req.headers,
    "Proxy-Authorization": `Basic ${Buffer.from(
      `${config.username}:${config.password}`
    ).toString("base64")}`,
  };

  const remoteRequest = request({
    host: config.host,
    port: config.port,
    method: req.method,
    path: req.url,
    headers: headersWithAuth,
  })
    .on("error", () => {
      res.writeHead(502).end();
    })
    .on("timeout", () => {
      res.writeHead(504).end();
    })
    .on("response", (remoteResponse) => {
      res.writeHead(remoteResponse.statusCode!, remoteResponse.headers);
      remoteResponse.pipe(res);
    });
  req.pipe(remoteRequest);
}).listen(config.escalatorPort);

httpServer.on("connect", (req, socket, head) => {
  console.log(`${new Date().toJSON()} ${req.method} ${req.url}`);

  if (req.method !== "CONNECT") {
    req.destroy();
    return;
  }

  const conn = net.createConnection(
    {
      host: config.host,
      port: config.port,
    },
    () => {
      conn.write(`CONNECT ${req.url} HTTP/1.1\n`);
      for (const key of Object.keys(req.headers)) {
        conn.write(`${key}: ${req.headers[key]}\n`);
      }

      const proxyAuthorization = `Basic ${Buffer.from(
        `${config.username}:${config.password}`
      ).toString("base64")}`;
      conn.write(`Proxy-Authorization: ${proxyAuthorization}\n`);

      conn.write("\n");

      conn.pipe(socket);
      conn.on("close", () => {
        socket.destroy();
      });
      conn.on("error", () => {
        socket.destroy();
      });

      socket.pipe(conn);
      socket.on("close", () => {
        conn.destroy();
      });
      socket.on("error", () => {
        conn.destroy();
      });
    }
  );
});
