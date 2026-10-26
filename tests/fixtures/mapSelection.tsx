import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import MapSelectionTool from '../../src/components/MapSelectionTool';
import '../../src/style.css';
function Fixture() {
 const [open,setOpen] = useState(false);
 return <main><button id="open" onClick={()=>setOpen(true)}>နယ်မြေဝိုက်ရွေး</button>{open && <MapSelectionTool focus={{x:-400,z:-650}} onClose={()=>setOpen(false)}/>}</main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
