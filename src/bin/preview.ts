#!/usr/bin/env node

import {ServeCommand} from '../commands/serve';
import {createCommand} from 'commander';

async function main() {
  const program = createCommand();
  program
    .command('serve-proxy')
    .description('run the proxy server')
    .action(options => {
      const cmd = new ServeCommand();
      cmd.run();
    });
  await program.parseAsync(process.argv);
}

main();
