import {Pod} from '@amagaki/amagaki';
import {PreviewPlugin} from '../preview';

export interface SyncCommandOptions {
  branch: string;
}

export class SyncCommand {
  async run(options: SyncCommandOptions) {
    const pod = new Pod('.');
    const plugin = PreviewPlugin.register(pod);
    if (!plugin) {
      return;
    }
    const result = await plugin.sync(options);
    if (result.paths && result.paths.length) {
      console.log(`Downloaded ${result.paths.length} files`);
    }
  }
}
