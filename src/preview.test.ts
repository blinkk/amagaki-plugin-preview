import {ExecutionContext} from 'ava';
import { Pod } from '@amagaki/amagaki';
import { getRouteData } from './preview';
import test from 'ava';

test('Test getRouteData', async (t: ExecutionContext) => {
  const pod = new Pod('./example');
  const data = await getRouteData(pod);
  t.deepEqual(data, {
    '/content/about.yaml': {
      en: {
        path: '/about/'
      },
    },
    '/content/index.yaml': {
      en: {
        path: '/'
      },
      ja: {
        path: '/ja/'
      }
    },
  });
});