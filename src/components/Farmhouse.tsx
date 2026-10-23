import { farmhouse } from '../data/ward';
import { House, FrontLotFence } from './House';
import { Gardens } from './Landmarks';

/** Farmhouse building and its garden, pond, owned land and entrance fence. */
export function Farmhouse(){return <><House h={farmhouse}/><Gardens/><FrontLotFence/></>}
