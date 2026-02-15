import * as readline from "readline";
import { loadCredentials, saveCredentials, getConfigDir } from "../config";
import { startOAuthFlow } from "../oauth";

interface SetupTokenOptions {
  apiKey?: string;
  oauth?: boolean;
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

  if (options.oauth) {
    await setupViaOAuth(options);
  } else {
    await setupViaApiKey(options.apiKey);
  }
}

async function setupViaApiKey(apiKey?: string): Promise<void> {
  let key = apiKey;

  if (!key) {
    key = await promptForApiKey();
  }

  if (!key) {
    console.error("No API key provided.");
    process.exit(1);
  }

  if (!key.startsWith("sk-ant-")) {
    console.error(
      'Invalid API key format. Anthropic API keys start with "sk-ant-".'
    );
    process.exit(1);
  }

  saveCredentials({
    access_token: key,
    token_type: "api-key",
  });

  console.log("API key saved successfully!");
  console.log(`Credentials stored in ${getConfigDir()}/credentials.json`);
}

function promptForApiKey(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("Enter your Anthropic API key.");
    console.log(
      "You can get one at: https://console.anthropic.com/settings/keys\n"
    );

    rl.question("API key (sk-ant-...): ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function setupViaOAuth(options: SetupTokenOptions): Promise<void> {
  console.log("Starting OAuth authentication flow...\n");
  console.log(
    "A browser window will open for you to authorize Claude Code.\n"
  );

  try {
    const open = (await import("open")).default;

    const flow = await startOAuthFlow({
      authBaseUrl: options.authUrl,
      tokenUrl: options.tokenUrl,
      clientId: options.clientId,
    });

    console.log("If the browser doesn't open automatically, visit:");
    console.log(`  ${flow.authUrl}\n`);

    open(flow.authUrl).catch(() => {
      // Silently ignore — URL is printed above
    });

    const tokenResponse = await flow.waitForToken();

    saveCredentials({
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: tokenResponse.expires_in
        ? Date.now() + tokenResponse.expires_in * 1000
        : undefined,
      token_type: tokenResponse.token_type,
    });

    console.log("Authentication successful!");
    console.log(`Credentials saved to ${getConfigDir()}/credentials.json`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Authentication failed: ${message}`);
    process.exit(1);
  }
}
