/**
 * Open-External HTTP Route - Accepts URL open requests from the WSL browser
 * shim and broadcasts them to connected WebSocket clients.
 *
 * This enables CLI tools running in WSL terminal sessions (e.g., `gcloud auth`)
 * to open URLs in the host Windows browser via the Electron desktop bridge.
 *
 * @module openExternalRoute
 */
import type http from "node:http";

const MAX_BODY_BYTES = 8_192;

function collectRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseUrlFromBody(body: string): string | null {
  // Support application/x-www-form-urlencoded (from curl --data-urlencode)
  const params = new URLSearchParams(body);
  return params.get("url") || null;
}

function isAllowedProtocol(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export interface OpenExternalRouteOptions {
  readonly authToken: string | undefined;
  readonly onUrl: (url: string) => void;
}

/**
 * Attempt to handle an incoming HTTP request as an open-external API call.
 *
 * Returns `true` if the request matched `/api/open-external` (regardless of
 * whether it succeeded), `false` otherwise — mirroring the pattern used by
 * `tryHandleProjectFaviconRequest`.
 */
export function tryHandleOpenExternalRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  options: OpenExternalRouteOptions,
): boolean {
  if (url.pathname !== "/api/open-external") {
    return false;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method Not Allowed");
    return true;
  }

  // Validate auth token when one is configured.
  if (options.authToken) {
    const authHeader = req.headers.authorization ?? "";
    const providedToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (providedToken !== options.authToken) {
      res.writeHead(401, { "Content-Type": "text/plain" });
      res.end("Unauthorized");
      return true;
    }
  }

  void collectRequestBody(req)
    .then((body) => {
      const targetUrl = parseUrlFromBody(body);
      if (!targetUrl || !isAllowedProtocol(targetUrl)) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Invalid or missing URL");
        return;
      }

      options.onUrl(targetUrl);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
    })
    .catch(() => {
      if (!res.writableEnded) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Error");
      }
    });

  return true;
}
