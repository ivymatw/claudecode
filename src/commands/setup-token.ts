import { loadCredentials, saveCredentials, getConfigDir } from "../config";
import { startOAuthFlow } from "../oauth";

interface SetupTokenOptions {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  force?: boolean;
}

export async function setupToken(options: SetupTokenOptions): Promise<void> {
  const existing = loadCredentials();

  if (existing && !options.force) {
    const isExpired =
      existing.expires_at != null && existing.expires_at < Date.now();
    if (!isExpired) {
      console.log("Existing credentials found.");
      console.log("Use --force to re-authenticate.");
      return;
    }
    console.log("Existing credentials have expired. Re-authenticating...\n");
  }

  console.log("Starting OAuth authentication flow...\n");
  console.log(
    "A browser window will open for you to authorize Claude Code.\n"
  );

  try {
    // Dynamically import 'open' (ESM-only package)
    const open = (await import("open")).default;

    const tokenPromise = startOAuthFlow({
      authBaseUrl: options.authUrl,
      tokenUrl: options.tokenUrl,
      clientId: options.clientId,
    });

    // Give the server a moment to start, then open browser
    // The auth URL is logged by startOAuthFlow's internal redirect URI setup,
    // but we also open the browser for the user
    const authUrl = buildAuthUrl(options);
    console.log("If the browser doesn't open automatically, visit:");
    console.log(`  ${authUrl}\n`);

    // Open browser (best-effort, don't fail if it can't open)
    open(authUrl).catch(() => {
      // Silently ignore — URL is printed above
    });

    const tokenResponse = await tokenPromise;

    const credentials = {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: tokenResponse.expires_in
        ? Date.now() + tokenResponse.expires_in * 1000
        : undefined,
      token_type: tokenResponse.token_type,
    };

    saveCredentials(credentials);

    console.log("Authentication successful!");
    console.log(`Credentials saved to ${getConfigDir()}/credentials.json`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Authentication failed: ${message}`);
    process.exit(1);
  }
}

function buildAuthUrl(options: SetupTokenOptions): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: options.clientId,
    scope: "api",
  });
  return `${options.authUrl}/oauth/authorize?${params.toString()}`;
}
