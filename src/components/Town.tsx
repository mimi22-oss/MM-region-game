import { ward } from '../data/ward';
import { Box } from './Primitives';
import { KalayWards } from './wards';
import { KalayVillages } from './villages';

export function Town(){return <>
 <color attach="background" args={['#c6ded8']}/><fog attach="fog" args={['#c6ded8',1800,5500]}/>
 <hemisphereLight args={['#e5f2ee','#697445',2]}/>
 <directionalLight position={[-80,180,60]} intensity={2.5} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-320} shadow-camera-right={320} shadow-camera-top={320} shadow-camera-bottom={-320} shadow-camera-far={650} shadow-normalBias={0.04}/>
 <Box position={[0,-0.3,0]} size={[ward.size,0.6,ward.size]} color="#92a36b"/>
 <KalayWards/>
 <KalayVillages/>
 {/* A low visual border; collision follows the ward boundary. */}
 {[-1,1].map(s=><group key={s}><Box position={[s*ward.size/2,0.2,0]} size={[0.16,0.4,ward.size]} color="#d6c598"/><Box position={[0,0.2,s*ward.size/2]} size={[ward.size,0.4,0.16]} color="#d6c598"/></group>)}
 </>}
