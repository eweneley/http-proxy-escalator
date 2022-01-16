import process from "process";
import { URL } from "url";
import { createServer } from "http";
import net from "net";

interface Config {
  host: string;
  port: number;
  username?: string;
  password?: string;

  escalatorPort: number;
}

function loadConfig(): Config {
  const urlEnvKey = "ESCALATOR_HTTPS_PROXY";

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

const httpServer = createServer((req, res) => {}).listen(config.escalatorPort);

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
