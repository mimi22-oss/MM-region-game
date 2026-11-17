import {selectMissionWeapon,useThreeGhostsMission} from '../../game/missions/threeGhostsMission';

export function WeaponMenu(){
  const mission=useThreeGhostsMission();
  if(!mission.completed)return null;
  return <label className="weapon-menu">Weapon
    <select aria-label="Weapon" value={mission.equippedWeapon??''}
      onChange={event=>selectMissionWeapon(event.currentTarget.value==='ghost-sword'?'ghost-sword':null)}>
      <option value="">လက်ဗလာ</option>
      <option value="ghost-sword">သရဲဓား</option>
    </select>
  </label>;
}
