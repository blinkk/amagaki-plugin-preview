import { Pod } from '@amagaki/amagaki';
import { PreviewPlugin } from '../dist';

export default function (pod: Pod) {
    PreviewPlugin.register(pod);
}