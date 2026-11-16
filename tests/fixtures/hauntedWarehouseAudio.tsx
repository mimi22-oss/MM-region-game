import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas} from '@react-three/fiber';
import {HauntedWarehouseAudioZone} from '../../src/components/HauntedWarehouseAudioZone';
import {EnvironmentAudio} from '../../src/components/EnvironmentAudio';
import {gameAudio} from '../../src/game/gameAudio';
import {acquireSharedGhostAudio} from '../../src/game/ghostAudio';
import {acquireSharedHorrorMixer} from '../../src/game/audio/HorrorAudioMixer';
import {sharedHorrorAssetLoader} from '../../src/game/audio/HorrorAudioAssetLoader';
import {getAudioDiagnosticsSnapshot} from '../../src/game/audio/horrorAudioDiagnostics';
import {GHOST_WAREHOUSE_ANCHOR as anchor} from '../../src/game/ghostConfig';
import {area5} from '../../src/data/wards/myothar/area5';
import {warehouseSoundOrigins} from '../../src/game/audio/warehouseSoundOrigins';
const api=window as any,synth=acquireSharedGhostAudio(),mixer=acquireSharedHorrorMixer();
api.zone={synth,mixer,loader:sharedHorrorAssetLoader,diag:getAudioDiagnosticsSnapshot,gameAudio,origins:warehouseSoundOrigins(area5.warehouses,area5.trees,anchor),ready:false};
function Fixture(){
 const [night,setNight]=useState(true),[distance,setDistance]=useState(50),[sound,setSound]=useState(true),[volume,setVolume]=useState(.3);
 api.zone.night=setNight;api.zone.distance=setDistance;api.zone.sound=setSound;api.zone.volume=setVolume;
 return <><button>Enable audio</button><EnvironmentAudio period={night?'night':'day'} volume={volume} enabled={sound} active/>
 <Canvas style={{width:64,height:64}} onCreated={()=>api.zone.ready=true} camera={{position:[anchor.x+50,2,anchor.z+4]}}>
  <group name="player-avatar" position={[anchor.x+distance,0,anchor.z]}/>
  <HauntedWarehouseAudioZone onDiagnostics={stats=>api.zone.stats=stats} enabled minute={night?1260:780} timeMode={night?'night':'day'} soundEnabled={sound} soundVolume={volume} occlusion/>
 </Canvas></>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
