import * as fs from 'fs';
import * as path from 'path';

import {DocumentRoute, Pod, ServerPlugin} from '@amagaki/amagaki';

import Keyv from 'keyv';
import {Octokit} from '@octokit/rest';
import cors from 'cors';
import express from 'express';

const Env = {
  GIT_BRANCH: (process.env.GIT_BRANCH as string) || 'main',
  GITHUB_PROJECT: process.env.GITHUB_PROJECT as string,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN as string,
};

const ORIGIN_HOSTS = [
  'https://editor.dev',
  'https://beta.editor.dev',
  'http://localhost:3000',
  'http://localhost:8080',
];

interface GetTreeOptions {
  sha: string;
}

interface Tree {
  path?: string | undefined;
  mode?: string | undefined;
  type?: string | undefined;
  sha?: string | undefined;
  size?: number | undefined;
  url?: string | undefined;
}

interface FetchFilesOptions {
  directory: string;
  sha: string;
  tree: Tree[];
}

interface SyncOptions {
  branch: string;
}

interface SyncResults {
  sha: string;
  paths: string[];
}

type RouteData = {
  path?: string;
};

type LocaleData = Record<string, RouteData>;

interface PreviewPluginOptions {
  /**
   * Is the plugin running in a dev (local server) mode?
   */
  isDev?: boolean;
}

export class PreviewPlugin {
  private pod: Pod;
  options?: PreviewPluginOptions;
  shaCache: Keyv;
  responseCache: Keyv;
  octokit: Octokit;
  owner: string;
  repo: string;

  static CONTENT_TYPES_TO_SYNC = ['html', 'json'];
  static EXTENSIONS_TO_NOT_SYNC_REGEX = /\.css$|\.js$|\.svg|\.jpg|\.png$/;
  static PATH_TO_SYNC = Pod.DefaultContentPodPath.replace(/^\//, '');

  constructor(pod: Pod, options?: PreviewPluginOptions) {
    this.pod = pod;
    this.options = options;
    this.shaCache = new Keyv();
    this.responseCache = new Keyv();
    this.octokit = new Octokit({
      auth: Env.GITHUB_TOKEN,
    });
    // Local server does not define the github project.
    if (Env.GITHUB_PROJECT) {
      [this.owner, this.repo] = Env.GITHUB_PROJECT.split('/');
    } else {
      this.owner = 'unknown';
      this.repo = 'unknown';
    }
  }

  static register(pod: Pod) {
    const hasTokens = Env.GITHUB_TOKEN && Env.GITHUB_PROJECT;
    const isDev = !hasTokens && pod.env.dev;

    if (isDev) {
      console.log('Preview plugin: Dev mode for local editor previews.');
    } else {
      // Hosted previews need the github information.
      if (!Env.GITHUB_TOKEN) {
        console.warn('Preview plugin: GITHUB_TOKEN not found, doing nothing.');
        return;
      }
      if (!Env.GITHUB_PROJECT) {
        console.warn(
          'Preview plugin: GITHUB_PROJECT not found, doing nothing.'
        );
        return;
      }
    }
    const preview = new PreviewPlugin(pod, {
      isDev,
    });
    const serverPlugin = pod.plugins.get('ServerPlugin') as ServerPlugin;
    serverPlugin.register(async (app: express.Express) => {
      app.set('json spaces', 2);
      const router = express.Router({
        mergeParams: true,
      });
      router.use(
        cors({
          credentials: true,
          origin: ORIGIN_HOSTS,
        })
      );
      router.use('/preview.json', getRoutesHandler(pod, preview));
      app.use(router);

      // If hosted, sync the github files.
      if (!isDev) {
        app.use(async (req, res, next) => {
          const branch =
            (req.headers['x-preview-branch'] as string) || Env.GIT_BRANCH;
          const shouldSyncPath =
            req.accepts(PreviewPlugin.CONTENT_TYPES_TO_SYNC) &&
            !req.path.match(PreviewPlugin.EXTENSIONS_TO_NOT_SYNC_REGEX);
          if (shouldSyncPath) {
            const {sha} = await preview.sync({
              branch: branch,
            });
            // Avoid rebuilding the page if the GitHub sha hasn't changed.
            const key = `${req.path}-${sha}`;
            const resp = await preview.responseCache.get(key);
            if (resp) {
              res.send(resp);
              return;
            } else {
              // @ts-ignore
              res.originalSend = res.send;
              // @ts-ignore
              res.send = async body => {
                await preview.responseCache.set(key, body);
                // @ts-ignore
                return res.originalSend(body);
              };
            }
          }
          next();
        });
      }
    });

    return preview;
  }

  async sync(options: SyncOptions): Promise<SyncResults> {
    const resp = await this.getTreeResponse({
      sha: options.branch,
    });
    // Only fetch and write files if the pod is out of sync with GitHub.
    let paths = [];
    if (!(await this.shaCache.get(resp.sha))) {
      console.log(
        `Syncing ${this.owner}/${this.repo} @ ${options.branch} -> ${resp.sha}`
      );
      this.pod.cache.reset();
      const files = await this.fetchFiles({
        tree: resp.tree,
        directory: PreviewPlugin.PATH_TO_SYNC,
        sha: options.branch,
      });
      paths = files.map(file => file.path);
      await Promise.all(files.map(writeFile));
      await this.shaCache.set(resp.sha, true);
    } else {
      console.log(
        `Already up to date ${this.owner}/${this.repo} @ ${options.branch} -> ${resp.sha}`
      );
    }
    return {
      sha: resp.sha,
      paths: paths,
    } as SyncResults;
  }

  async fetchFiles(options: FetchFilesOptions) {
    const files = options.tree
      .filter(
        (node: any) =>
          node.path.startsWith(options.directory) && node.type === 'blob'
      )
      .map(async (node: any) => {
        const {data} = await this.octokit.git.getBlob({
          owner: this.owner,
          repo: this.repo,
          file_sha: node.sha,
        });
        return {
          path: node.path,
          // @ts-ignore
          contents: Buffer.from(
            data.content as string,
            data.encoding as string
          ),
        };
      });
    return Promise.all(files);
  }

  async getTreeResponse(options: GetTreeOptions) {
    try {
      const {data: resp} = await this.octokit.git.getTree({
        owner: this.owner,
        repo: this.repo,
        tree_sha: options.sha,
        recursive: 'true',
      });
      return resp;
    } catch (err) {
      console.error(err);
      throw new Error(
        `Could not fetch tree for ${this.owner}/${this.repo} @ ${options.sha}`
      );
    }
  }
}

export const getRouteData = async (pod: Pod) => {
  const routes: Record<string, LocaleData | RouteData> = {};
  for (const route of await pod.router.routes()) {
    if (!route.podPath) {
      continue;
    }

    if (
      route instanceof DocumentRoute ||
      // instanceof does not work for the type checking
      // when using npm link or ???
      route.constructor.name === 'DocumentRoute'
    ) {
      if (!routes[route.podPath]) {
        routes[route.podPath] = {};
      }
      (routes[route.podPath] as LocaleData)[
        (route as DocumentRoute).locale.id
      ] = {
        path: route.url.path,
      };
    } else {
      routes[route.podPath] = {
        path: route.url.path,
      };
    }
  }
  return routes;
};

const getRoutesHandler = (pod: Pod, preview: PreviewPlugin) => {
  return async (req: express.Request, res: express.Response) => {
    let branch: string | undefined = undefined;
    let sha: string | undefined = undefined;
    if (!preview.options?.isDev) {
      branch = (req.headers['x-preview-branch'] as string) || Env.GIT_BRANCH;
      sha = (
        await preview.sync({
          branch: branch,
        })
      ).sha;
    }
    const routes = await getRouteData(pod);
    return res.json({
      repo: {
        githubProject: Env.GITHUB_PROJECT,
        branch: branch,
        sha: sha,
      },
      defaultLocale: pod.defaultLocale.id,
      routes: routes,
    });
  };
};

const writeFile = async (file: {path: string; contents: Buffer}) => {
  fs.mkdirSync(path.dirname(file.path), {recursive: true});
  await fs.promises.writeFile(file.path, file.contents);
};
