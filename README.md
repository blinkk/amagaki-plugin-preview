# amagaki-plugin-preview

[![NPM Version][npm-image]][npm-url]
[![GitHub Actions][github-image]][github-url]
[![TypeScript Style Guide][gts-image]][gts-url]

An experimental plugin for Amagaki that facilitates content previews.

Features include:

- **Content fetching**: Fetches content from GitHub. Content updates are available without rebuilding the site.
- **Live rebuilding**: Rebuilds static content and deploys it as needed to a static server.

[github-image]: https://github.com/blinkk/amagaki-plugin-staging/workflows/Run%20tests/badge.svg
[github-url]: https://github.com/blinkk/amagaki-plugin-staging/actions
[npm-image]: https://img.shields.io/npm/v/@amagaki/amagaki-plugin-staging.svg
[npm-url]: https://npmjs.org/package/@amagaki/amagaki-plugin-staging
[gts-image]: https://img.shields.io/badge/code%20style-google-blueviolet.svg
[gts-url]: https://github.com/google/gts

## Usage

```
import { PreviewPlugin } from '@amagaki/amagaki-plugin-preview';

export default function (pod: Pod) {
    PreviewPlugin.register(pod);
}
```

## Continuous deployment

### Configuration on GitHub Actions

1. Visit the Service Accounts page: https://pantheon.corp.google.com/iam-admin/serviceaccounts
2. Download a JSON key for the `Compute Engine default service account`.
3. Encode the service account key:

```shell
openssl base64 -in <file>.json  | pbcopy
```

4. Paste the result into a GitHub Secret named `GCP_SA_KEY`.
5. Create a GitHub Secret called `GH_TOKEN` that has a GitHub token (i.e. a
   Personal Access Token) of an account that has read access to your repo. NOTE:
   This requirement will be abandoned in a future version as we can authenticate
   via GitHub Actions' built-in token instead.
6. Copy `.github/workflows/deploy-preview-server.yml` into your repository.
7. Set the following variables:

- `GCP_PROJECT_ID`
- `SITE`