import { toWorld, ward } from '../../src/data/ward';
import { MountainWildlifeAudioController, WILDLIFE_INITIAL_DELAY_MAX_SEC } from '../../src/game/mountainWildlifeAudio';
import { gameAudio } from '../../src/game/gameAudio';
import {
  loadSfxBuffer,
  WILDLIFE_DEER_BABY_AUDIO_FILES,
  WILDLIFE_DEER_STAG_AUDIO_FILES,
  WILDLIFE_TIGER_AUDIO_FILES,
} from '../../src/game/audio/sfxBufferCache';
const peaks = [...ward.mountains, ...ward.weipula.peaks];
if (location.search.includes('view=audio')) {
  gameAudio.attach();
  document.title = 'Preview ready';
  (window as any).audioReady = () => gameAudio.context?.state === 'running';
  (window as any).measureCall = async (type: 'tiger' | 'deer') => {
    const ctx = gameAudio.context!;
    const controller = new MountainWildlifeAudioController();
    const here = toWorld(-1500,5200);
    const cats = type === 'tiger' ? [{homeX: here.x - 18, homeZ: here.z}] : [];
    const deer = type === 'deer' ? [{homeX: here.x + 18, homeZ: here.z}] : [];
    const tick = (dt: number) => controller.step(dt,here.x,here.z,0,-1,peaks,cats,deer);
    tick(0);
    const files = type === 'tiger' ? WILDLIFE_TIGER_AUDIO_FILES
      : [...WILDLIFE_DEER_BABY_AUDIO_FILES, ...WILDLIFE_DEER_STAG_AUDIO_FILES];
    const buffers = await Promise.all(files.map(file => loadSfxBuffer(ctx, file)));
    if (buffers.some(buffer => buffer === null)) throw new Error('Wildlife audio sample did not decode');
    // Tap the existing ambience bus without affecting output.
    const splitter = ctx.createChannelSplitter(2);
    gameAudio.ambience!.connect(splitter);
    const meters = [ctx.createAnalyser(),ctx.createAnalyser()];
    for (const [i,meter] of meters.entries()) {
      meter.fftSize = 1024;
      splitter.connect(meter,i);
    }
    const rng = Math.random;
    try {
      Math.random = () => .02;
      for (let elapsed = 0; elapsed <= WILDLIFE_INITIAL_DELAY_MAX_SEC; elapsed += .25) tick(.25);
    } finally { Math.random = rng; }
    const energy = [0,0], values = new Float32Array(1024);
    for(let i=0;i<30;i++){
      await new Promise(r=>setTimeout(r,45));
      for (const [j,meter] of meters.entries()) {
        meter.getFloatTimeDomainData(values);
        energy[j] += values.reduce((sum,x)=>sum+x*x,0)/1024;
      }
    }
    gameAudio.ambience!.disconnect(splitter);
    splitter.disconnect();
    const state = controller.getState();
    const call = (controller as any).lastEvent;
    controller.dispose();
    return {energy, call, state};
  };
}

