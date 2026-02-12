#!/usr/bin/env node

import { Command } from "commander";
import { setupToken } from "./commands/setup-token";

const program = new Command();

program
  .name("claude")
  .description("CLI tool for Claude Code authentication and token management")
  .version("0.1.0");

program
  .command("setup-token")
  .description("Authenticate with Claude via OAuth and store credentials")
  .option(
    "--auth-url <url>",
    "Custom authorization base URL",
    "https://console.anthropic.com"
  )
  .option(
    "--token-url <url>",
    "Custom token endpoint URL",
    "https://api.anthropic.com/v1/oauth/token"
  )
  .option("--client-id <id>", "OAuth client ID", "claude-code-cli")
  .option("--force", "Re-authenticate even if credentials already exist")
  .action(setupToken);

program.parse(process.argv);
