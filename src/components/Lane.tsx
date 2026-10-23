import { ward } from '../data/ward';
import { Road, type RoadData } from './Road';
export function Lane({r}:{r:RoadData}){return <Road r={r}/>}
export function Lanes(){return <>{ward.roads.filter(r=>!r.main).map(r=><Lane key={r.id} r={r}/>)}</>}
