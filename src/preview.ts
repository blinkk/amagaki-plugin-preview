import * as fs from 'fs';
import * as path from 'path';

import {DocumentRoute, Pod, ServerPlugin} from '@amagaki/amagaki';

import Keyv from 'keyv';
import {Octokit} from '@octokit/rest';
import express from 'express';

const Env = {
  GIT_BRANCH: (process.env.GIT_BRANCH as string) || 'main',
  GITHUB_PROJECT: process.env.GITHUB_PROJECT as string,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN as string,
};

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

export class PreviewPlugin {
  private pod: Pod;
  shaCache: Keyv;
  octokit: Octokit;
  owner: string;
  repo: string;

  static CONTENT_TYPES_TO_SYNC = ['html', 'json'];
  static PATH_TO_SYNC = Pod.DefaultContentPodPath.replace(/^\//, '');

  constructor(pod: Pod) {
    this.pod = pod;
    this.shaCache = new Keyv();
    this.octokit = new Octokit({
      auth: Env.GITHUB_TOKEN,
    });
    [this.owner, this.repo] = Env.GITHUB_PROJECT.split('/');
  }

  static register(pod: Pod) {
    if (!Env.GITHUB_TOKEN) {
      console.warn('Preview plugin: GITHUB_TOKEN not found, doing nothing.');
      return;
    }
    if (!Env.GITHUB_PROJECT) {
      console.warn('Preview plugin: GITHUB_PROJECT not found, doing nothing.');
      return;
    }
    const preview = new PreviewPlugin(pod);
    const serverPlugin = pod.plugins.get('ServerPlugin') as ServerPlugin;
    serverPlugin.register(async (app: express.Express) => {
      app.set('json spaces', 2);
      app.use('/_preview/routes.json', getRoutesHandler(pod, preview));
      app.use(async (req, res, next) => {
        const branch =
          (req.headers['x-preview-branch'] as string) || Env.GIT_BRANCH;
        if (req.accepts(PreviewPlugin.CONTENT_TYPES_TO_SYNC)) {
          await preview.sync({
            branch: branch,
          });
        }
        next();
      });
    });
  }

  async sync(options: SyncOptions) {
    const resp = await this.getTreeResponse({
      sha: options.branch,
    });
    // Only fetch and write files if the pod is out of sync with GitHub.
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
      await Promise.all(files.map(writeFile));
      await this.shaCache.set(resp.sha, true);
    } else {
      console.log(
        `Already up to date ${this.owner}/${this.repo} @ ${options.branch} -> ${resp.sha}`
      );
    }
    return {
      sha: resp.sha,
    };
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
    const {data: resp} = await this.octokit.git.getTree({
      owner: this.owner,
      repo: this.repo,
      tree_sha: options.sha,
      recursive: 'true',
    });
    return resp;
  }
}

export const getRouteData = async (pod: Pod) => {
  type RouteData = {
    path?: string;
  };
  type LocaleData = Record<string, RouteData>;
  const routes: Record<string, LocaleData> = {};
  for (const route of await pod.router.routes()) {
    if (!route.podPath) {
      continue;
    }
    if (!routes[route.podPath]) {
      routes[route.podPath] = {};
    }
    const locale = route instanceof DocumentRoute ? route.locale.id : 'default';
    routes[route.podPath][locale] = {
      path: route.url.path,
    };
  }
  return routes;
};

const getRoutesHandler = (pod: Pod, preview: PreviewPlugin) => {
  return async (req: express.Request, res: express.Response) => {
    const branch =
      (req.headers['x-preview-branch'] as string) || Env.GIT_BRANCH;
    const {sha} = await preview.sync({
      branch: branch,
    });
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
