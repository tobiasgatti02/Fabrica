import { Composition, registerRoot } from 'remotion';
import { ProductDemo } from './Root';
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from './config';

export const RemotionRoot = () => <Composition id="fabrica-demo" component={ProductDemo} durationInFrames={DURATION_IN_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />;

registerRoot(RemotionRoot);

export default RemotionRoot;