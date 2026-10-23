import { ward } from '../data/ward';
import { Road } from './Road';
export function MainRoad(){return <>{ward.roads.filter(r=>r.main).map(r=><Road key={r.id} r={r}/>)}</>}
