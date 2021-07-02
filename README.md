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