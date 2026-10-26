import { StreamedWorld, type StreamedWorldProps } from './StreamedWorld';
import { Mountains } from './Mountains';
import { memo } from 'react';

import { ward } from '../data/ward';
import { Box } from './Primitives';
import {TimeEnvironment} from './TimeEnvironment';
import {periodAtMinute} from '../game/environmentTime';
import {CandleAnimation} from './Candle';
import {FestivalLighting} from './FestivalLighting';
import {FireBalloonSky} from './FireBalloonSky';

export const Town = memo(function Town({ minute = 780, ...streaming }: { minute?: number } & StreamedWorldProps) {
 const period=periodAtMinute(minute),night=period==='night'||period==='evening';
	return (
		<>
            <CandleAnimation/>
            <FestivalLighting night={night}/>
            <FireBalloonSky active={night} balloonsPerVillage={400} />
            <TimeEnvironment minute={minute}/>

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
