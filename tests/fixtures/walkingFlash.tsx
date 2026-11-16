import React, { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Town } from '../../src/components/Town';
import { Player } from '../../src/components/Player';
import { FrameBudget } from '../../src/components/FrameBudget';
import { ward } from '../../src/data/ward';
const api = window as any;
const params = new URLSearchParams(location.search), dprOnly = params.has('dprOnly'), fixed = params.get('fixed') !== '0';
api.flash = { frames: [], lost: 0, restored: 0, loading: true };
function Inspect() {
	const state = useThree(); api.flash.getDpr = () => state.gl.getPixelRatio(); api.flash.imperativeDpr = state.setDpr;
	useFrame(({ camera, scene, gl }, dt) => {
		const p = scene.getObjectByName('player-avatar');
		if (api.flash.record) api.flash.frames.push({ dt, camera: camera.position.toArray(), player: p?.position.toArray(), dpr: gl.getPixelRatio(), width: gl.domElement.width, height: gl.domElement.height, calls: gl.info.render.calls, regions: scene.children.filter(o => o.name.startsWith('detail-')).map(o => o.name) });
	}); return null;
}
function Fixture() {
	const [loading, setLoading] = useState(true), [zoom, setZoom] = useState(6), [topDown, setTopDown] = useState(false);
	const [dpr, setDpr] = useState(1.25), [, setPosition] = useState({ x: 0, z: 0 });
	api.flash.adapt = (value: number) => fixed ? setDpr(value) : api.flash.imperativeDpr(value);
	api.flash.parentUpdate = () => setPosition({ x: Math.random(), z: 0 });
	const ignore = useCallback(() => { }, []), loaded = useCallback((s: any) => { setLoading(s.blocking); api.flash.loading = s.blocking; }, []);
	return <Canvas dpr={fixed ? dpr : 1.25} shadows style={{ width: '100vw', height: '100vh' }} camera={{ position: [ward.spawn.x, 3, ward.spawn.z + 6], far: 9000 }}
		onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', () => api.flash.lost++); gl.domElement.addEventListener('webglcontextrestored', () => api.flash.restored++); }}>
		{!dprOnly && <><FrameBudget paused={loading} onDprChange={setDpr} /><Town minute={780} paused={loading} onLoadingChange={loaded} onSceneError={() => api.flash.error = true} />
			<Player character="cartoon" loading={loading} controlsBlocked={loading} mapOpen={false} zoom={zoom} topDown={topDown} onPosition={setPosition} onMode={ignore} onLock={ignore} onZoom={setZoom} onTopDown={setTopDown} /></>}
		<Inspect />
	</Canvas>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
