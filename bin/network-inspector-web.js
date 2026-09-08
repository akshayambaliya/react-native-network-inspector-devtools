#!/usr/bin/env node
'use strict';

const { exec } = require('child_process');
const { startServer } = require('../server');

function parsePort(argv) {
  const flagIndex = argv.findIndex((arg) => arg === '--port' || arg === '-p');
  if (flagIndex !== -1 && argv[flagIndex + 1]) {
    const parsed = Number(argv[flagIndex + 1]);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return 8973;
}

function openBrowser(url) {
  const command =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(command, () => {
    // Best-effort only — the developer can always open the URL manually.
  });
}

async function main() {
  const port = parsePort(process.argv.slice(2));
  const noOpen = process.argv.includes('--no-open');

  try {
    const { port: boundPort } = await startServer({ port });
    const url = `http://localhost:${boundPort}`;

    console.log('');
    console.log('  react-native-network-inspector-devtools — web panel');
    console.log(`  Listening on ${url}`);
    console.log('  Waiting for your app to connect (enableWebSync={__DEV__})...');
    console.log('');

    if (!noOpen) openBrowser(url);
  } catch (err) {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Pass --port <number> to use a different one.`);
    } else {
      console.error('Failed to start the web panel server:', err);
    }
    process.exitCode = 1;
  }
}

main();
