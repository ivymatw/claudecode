import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".claude-code");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");

export interface Credentials {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type: string;
}

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

export function saveCredentials(credentials: Credentials): void {
  ensureConfigDir();
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), {
    mode: 0o600,
  });
}

export function loadCredentials(): Credentials | null {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    return null;
  }
  try {
    const data = fs.readFileSync(CREDENTIALS_FILE, "utf-8");
    return JSON.parse(data) as Credentials;
  } catch {
    return null;
  }
}

export function clearCredentials(): void {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    fs.unlinkSync(CREDENTIALS_FILE);
  }
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}
