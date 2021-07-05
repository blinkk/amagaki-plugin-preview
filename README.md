# amagaki-plugin-preview

[![NPM Version][npm-image]][npm-url] [![GitHub
Actions][github-image]][github-url] [![TypeScript Style
Guide][gts-image]][gts-url]

An experimental plugin for Amagaki that facilitates content previews.

Features include:

- **Content fetching**: Fetches content from GitHub. Content updates are
  available without rebuilding the site.
- **Live rebuilding**: Rebuilds static content and deploys it as needed to a
  static server.

[github-image]:
https://github.com/blinkk/amagaki-plugin-staging/workflows/Run%20tests/badge.svg
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

1. Visit the Service Accounts page:
   https://console.cloud.google.com/iam-admin/serviceaccounts
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
7. Set the following variables within:

- `GCP_PROJECT_ID`
- `SITE`

## Proxy server

### Cloud Run instances

- All preview servers are deployed to their own Cloud Run instances
- There is one Cloud Run instance per site per branch
- Cloud Run instances are deployed for every frontend code change (not content)
- All Cloud Run instances do not allow unauthenticated traffic
- Each instance is deployed with labels that identify the instance within the
  GCP project

### Routing requests to backends

A central proxy server is deployed one time only, which provides:

- Authenication
- Clean URLs
- Routing to individual Cloud Run instances

Unauthenticated traffic is permitted to the instance, and the instance
authorizes requests within the application.

Requests to the proxy invoke a lookup of the Cloud Run instance, mapping its
hostname to labels written when it was deployed. For example, using
`https://site--main.instance.com`:

```
preview_site=site
preview_branch=main
```

If no instance at all is found, show an error message that explains the Cloud
Run instance hasn't been deployed yet. If a base instance is found (i.e. against
the `main` or `master` branch), yet no branch instance is found, the request
will be served by the main instance. This facilitates instant previews of
branches without requiring a the Cloud Run instance to be deployed first.

Once the lookup occurs and once an instance has been found, the result is cached
to a file on the proxy's filesystem. Because the filesystem is ephemeral, the
lookup result is only cached as long as the file remains. If a backend is not
found given a hostname, the result is not cached.

The proxy server is deployed once per tenant or orgnaization.