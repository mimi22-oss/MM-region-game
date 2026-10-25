import { StreamedWorld, type StreamedWorldProps } from './StreamedWorld';
import { Mountains } from './Mountains';
import { memo } from 'react';
import { StaticBatch } from './StaticBatch';
import { ward } from '../data/ward';
import { Box } from './Primitives';
import { NightEnvironment } from './NightEnvironment';

export const Town = memo(function Town({ night = false, ...streaming }: { night?: boolean } & StreamedWorldProps) {
	return (
		<>
			{night ? (
				<>
					{/* ညချမ်း ကောင်းကင်နှင့် မြူခိုး (Midnight Blue Atmosphere) */}
					<color attach="background" args={['#08101e']} />
					<fog attach="fog" args={['#08101e', 1400, 6800]} />
					{/* ညလရောင်နှင့် ကောင်းကင် ပတ်ဝန်းကျင်အလင်း (Cool Ambient Moonlight) */}
					<hemisphereLight args={['#1c2d47', '#081116', 0.65]} />
					{/* လမင်းကြီးထံမှ ထိုးကျလာသော ငွေရောင်လရောင် (Directional Moonlight) */}
					<directionalLight
						position={[-60, 180, 80]}
						intensity={0.85}
						color="#9bbbee"
						castShadow
						shadow-mapSize={[1024, 1024]}
						shadow-camera-left={-320}
						shadow-camera-right={320}
						shadow-camera-top={320}
						shadow-camera-bottom={-320}
						shadow-camera-far={650}
						shadow-normalBias={0.04}
					/>
					{/* ညဘက် မြေပြင်အောက်ခံအရောင် (Dark Night Ground) */}
					<Box position={[0, -0.3, 0]} size={[ward.size, 0.6, ward.size]} color="#1a271f" />
					{/* ညဘက် ကြယ်တာရာများ၊ လမင်းကြီးနှင့် မီးရောင်စုံများ */}
					<StaticBatch><NightEnvironment /></StaticBatch>
				</>
			) : (
				<>
					{/* နေ့ခင်း နေရောင်ခြည်နှင့် ကောင်းကင် (Daylight Atmosphere) */}
					<color attach="background" args={['#c6ded8']} />
					<fog attach="fog" args={['#c6ded8', 2200, 7500]} />
					<hemisphereLight args={['#e5f2ee', '#697445', 2]} />
					<directionalLight
						position={[-80, 180, 60]}
						intensity={2.5}
						castShadow
						shadow-mapSize={[1024, 1024]}
						shadow-camera-left={-320}
						shadow-camera-right={320}
						shadow-camera-top={320}
						shadow-camera-bottom={-320}
						shadow-camera-far={650}
						shadow-normalBias={0.04}
					/>
					<Box position={[0, -0.3, 0]} size={[ward.size, 0.6, ward.size]} color="#92a36b" />
				</>
			)}

			<StreamedWorld {...streaming} />
            <Mountains />

			{/* A low visual border; collision follows the ward boundary. */}
			{[-1, 1].map(s => (
				<group key={s}>
					<Box
						position={[s * ward.size / 2, 0.2, 0]}
						size={[0.16, 0.4, ward.size]}
						color={night ? '#48554c' : '#d6c598'}
					/>
					<Box
						position={[0, 0.2, s * ward.size / 2]}
						size={[ward.size, 0.4, 0.16]}
						color={night ? '#48554c' : '#d6c598'}
					/>
				</group>
			))}
		</>
	);
});
