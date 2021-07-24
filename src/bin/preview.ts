#!/usr/bin/env node

import {ServeCommand} from '../commands/serve';
import {SyncCommand} from '../commands/sync';
import {createCommand} from 'commander';

async function main() {
  const program = createCommand();
  program
    .command('serve-proxy')
    .description('run the proxy server')
    .action(() => {
      const cmd = new ServeCommand();
      cmd.run();
    });
  program
    .command('sync')
    .description('sync files from git')
    .option('-b, --branch [branch]', 'branch name to sync')
    .action(options => {
      const cmd = new SyncCommand();
      cmd.run(options);
    });
  await program.parseAsync(process.argv);
}

main();
