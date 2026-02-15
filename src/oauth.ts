import * as http from "http";
import * as crypto from "crypto";
import * as url from "url";

const DEFAULT_AUTH_BASE_URL = "https://console.anthropic.com";
const DEFAULT_TOKEN_URL = "https://api.anthropic.com/v1/oauth/token";
const DEFAULT_CLIENT_ID = "claude-code-cli";
const REDIRECT_PORT_RANGE = { min: 49152, max: 65535 };
const CALLBACK_PATH = "/oauth/callback";

interface OAuthConfig {
  authBaseUrl?: string;
  tokenUrl?: string;
  clientId?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

function generateRandomString(length: number): string {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Could not find available port")));
      }
    });
    server.on("error", reject);
  });
}

export interface OAuthFlowHandle {
  authUrl: string;
  waitForToken: () => Promise<TokenResponse>;
}

export async function startOAuthFlow(
  config: OAuthConfig = {}
): Promise<OAuthFlowHandle> {
  const authBaseUrl = config.authBaseUrl ?? DEFAULT_AUTH_BASE_URL;
  const tokenUrl = config.tokenUrl ?? DEFAULT_TOKEN_URL;
  const clientId = config.clientId ?? DEFAULT_CLIENT_ID;

  const port = await findAvailablePort();
  const redirectUri = `http://127.0.0.1:${port}${CALLBACK_PATH}`;

  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const authParams = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: "api",
  });

  const authUrl = `${authBaseUrl}/oauth/authorize?${authParams.toString()}`;

  // Start the callback server immediately so it's ready before the browser opens
  const callbackPromise = waitForCallback(port, state);

  return {
    authUrl,
    waitForToken: async () => {
      const authCode = await callbackPromise;
      return exchangeCodeForToken({
        code: authCode,
        redirectUri,
        clientId,
        codeVerifier,
        tokenUrl,
      });
    },
  };
}

function waitForCallback(port: number, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith(CALLBACK_PATH)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const parsedUrl = new url.URL(req.url, `http://127.0.0.1:${port}`);
      const code = parsedUrl.searchParams.get("code");
      const state = parsedUrl.searchParams.get("state");
      const error = parsedUrl.searchParams.get("error");

      if (error) {
        const errorDescription =
          parsedUrl.searchParams.get("error_description") ?? error;
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(
          buildHtmlResponse(
            "Authentication Failed",
            `Error: ${errorDescription}. You can close this window.`
          )
        );
        server.close();
        reject(new Error(`OAuth error: ${errorDescription}`));
        return;
      }

      if (state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(
          buildHtmlResponse(
            "Authentication Failed",
            "State mismatch — possible CSRF attack. You can close this window."
          )
        );
        server.close();
        reject(new Error("OAuth state mismatch"));
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(
          buildHtmlResponse(
            "Authentication Failed",
            "No authorization code received. You can close this window."
          )
        );
        server.close();
        reject(new Error("No authorization code received"));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        buildHtmlResponse(
          "Authentication Successful",
          "You have been authenticated. You can close this window and return to the terminal."
        )
      );
      server.close();
      resolve(code);
    });

    server.listen(port, "127.0.0.1", () => {
      // Server is ready and listening
    });

    // Timeout after 5 minutes
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Authentication timed out after 5 minutes"));
    }, 5 * 60 * 1000);

    server.on("close", () => clearTimeout(timeout));
  });
}

interface TokenExchangeParams {
  code: string;
  redirectUri: string;
  clientId: string;
  codeVerifier: string;
  tokenUrl: string;
}

async function exchangeCodeForToken(
  params: TokenExchangeParams
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
  });

  const response = await fetch(params.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Token exchange failed (${response.status}): ${errorBody}`
    );
  }

  return (await response.json()) as TokenResponse;
}

function buildHtmlResponse(title: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>${title}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; display: flex;
    justify-content: center; align-items: center; min-height: 100vh;
    margin: 0; background: #f8f9fa; }
  .card { background: white; border-radius: 12px; padding: 2rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
  h1 { font-size: 1.3rem; margin-bottom: 0.5rem; }
  p { color: #666; }
</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body>
</html>`;
}

