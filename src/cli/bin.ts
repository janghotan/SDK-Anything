#!/usr/bin/env node
import { createCli } from './index.js';

const cli = createCli();
cli.parseAsync(process.argv).catch((err) => {
  if (err?.code !== 'commander.helpDisplayed' && err?.code !== 'commander.version') {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
});
