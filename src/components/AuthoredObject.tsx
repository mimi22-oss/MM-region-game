import {createContext,useContext,type ReactNode} from 'react';
import {sourceIsEdited} from '../game/worldEdits';
/** Replacement models may reuse original components without suppressing themselves. */
export const ReplacementModelContext=createContext(false);
export function AuthoredObject({id,children}:{id:string;children:ReactNode}){
 const replacement=useContext(ReplacementModelContext);
 return !replacement&&sourceIsEdited(id)?null:<>{children}</>;
}
