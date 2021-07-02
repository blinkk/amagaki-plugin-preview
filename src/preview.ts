import * as fs from 'fs';
import * as path from 'path';

import { DocumentRoute, Pod, ServerPlugin } from '@amagaki/amagaki';

import Keyv from 'keyv';
import { Octokit } from '@octokit/rest';
import express from 'express';

const Env = {
  DEFAULT_BRANCH: 'main',
  GITHUB_BRANCH: process.env.GITHUB_BRANCH as string,
  GITHUB_PROJECT: process.env.GITHUB_PROJECT as string,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN as string,
};

interface GetTreeOptions {
  owner: string;
  repo: string;
  sha: string;
}

interface FetchFilesOptions {
  directory: string;
  owner: string;
  repo: string
  sha: string;
}

export class PreviewPlugin {
  private pod: Pod;
  cache: Record<string, string>;
  keyv: Keyv;

  constructor(pod: Pod) {
    this.pod = pod;
    this.cache = {};
    this.keyv = new Keyv();
  }

  static register(pod: Pod) {
    if (!Env.GITHUB_TOKEN) {
      console.warn('GITHUB_TOKEN not found, doing nothing.');
      return;
    }
    const preview = new PreviewPlugin(pod);
    const serverPlugin = pod.plugins.get('ServerPlugin') as ServerPlugin;
    serverPlugin.register(async (app: express.Express) => {
      app.use(async (req, res, next) => {
        if (req.path.split('?')[0].endsWith('/')) {
          pod.cache.reset();
          await preview.warmup();
        }
        next();
      });
      app.use('/_preview/routes.json', async (req, res, next) => {
        pod.cache.reset();
        await preview.warmup();
        const routes = await getRouteData(pod);
        return res.json({
          routes: routes
        });
      });
    });
  }

  async warmup() {
    await this.keyv.clear();
    const [owner, repo] = Env.GITHUB_PROJECT.split('/');
    const octokit = new Octokit({
      auth: Env.GITHUB_TOKEN,
    });
    const files = await this.fetchFiles(
      octokit,
      {
        owner: owner,
        repo: repo,
        directory: Pod.DefaultContentPodPath.replace(/^\//, ''),
        sha: Env.GITHUB_BRANCH,
      }
    );
    return Promise.all(files.map(output));
  }

  async fetchFiles(
    octokit: Octokit, options: FetchFilesOptions
  ) {
    const tree = await this.getTree(octokit, {
      owner: options.owner,
      repo: options.repo,
      sha: options.sha
    });
    const files = tree
      .filter(
        (node: any) => node.path.startsWith(options.directory) && node.type === 'blob'
      )
      .map(async (node: any) => {
        const { data } = await octokit.git.getBlob({
          owner: options.owner,
          repo: options.repo,
          file_sha: node.sha,
        });
        return {
          path: node.path,
          // @ts-ignore
          contents: Buffer.from(data.content as string, data.encoding as string),
        };
      });
    return Promise.all(files);
  }

  async getTree(octokit: Octokit, options: GetTreeOptions) {
    const sha = options.sha || Env.DEFAULT_BRANCH;
    const cacheKey = `${options.owner}/${options.repo}#${sha}`;
    const cachedTree = await this.keyv.get(cacheKey);
    if (cachedTree) {
      return cachedTree;
    }
    const {
      data: { tree },
    } = await octokit.git.getTree({
      owner: options.owner,
      repo: options.repo,
      tree_sha: sha,
      recursive: 'true',
    });
    await this.keyv.set(cacheKey, tree);
    return tree;
  }
}

export const getRouteData = async (pod: Pod) => {
  type RouteData = {
    path?: string;
  }
  type LocaleData = Record<string, RouteData>;
  const routes: Record<string, LocaleData> = {};
  for (const route of await pod.router.routes()) {
    if (!routes[route.path]) {
      routes[route.path] = {};
    }
    const locale = route instanceof DocumentRoute ? route.locale.id : 'default';
    routes[route.path][locale] = {
      path: route.url.path,
    };
  }
  return routes;
}

async function createDirectories(filePath: string) {
  const dir = path.dirname(filePath);
  return fs.mkdirSync(dir, { recursive: true });
}

async function output(file: any) {
  await createDirectories(file.path);
  await fs.promises.writeFile(file.path, file.contents);
}