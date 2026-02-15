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
  .description(
    "Set up authentication credentials (API key or OAuth) and store them"
  )
  .option("--api-key <key>", "Anthropic API key (sk-ant-...)")
  .option("--oauth", "Use OAuth browser flow instead of API key")
  .option(
    "--auth-url <url>",
    "Custom authorization base URL (OAuth only)",
    "https://console.anthropic.com"
  )
  .option(
    "--token-url <url>",
    "Custom token endpoint URL (OAuth only)",
    "https://api.anthropic.com/v1/oauth/token"
  )
  .option("--client-id <id>", "OAuth client ID (OAuth only)", "claude-code-cli")
  .option("--force", "Re-authenticate even if credentials already exist")
  .action(setupToken);

program.parse(process.argv);
