# Reusable people, robots and cars

`src/data/appearance.ts` is the typed preset registry. `normalizeAppearance` validates saved settings; `src/game/appearanceStore.ts` persists the player's choices under `myanmar-town.appearance.v1`. Settings affect the player, their human driver and their summonable car. NPC palettes remain independent.

The render components accept appearance data directly, so NPCs and previews do not need to read or mutate player settings:

```tsx
const mother = { ...HUMAN_PRESETS.mother, clothingColor: '#267955' };
<CartoonCharacter appearance={mother} motion={motionRef} />
<CartoonCharacter appearance={HUMAN_PRESETS.grandmother} motion={otherMotionRef} />
<RobotCharacter wheels={wheelsRef} motion={motionRef}
  appearance={{ color:'#efbd65', accent:'#596cc2', size:1.1, legs:'feet', hands:'claw' }} />
<Car model="lighttruck" color="#477358" size={1} />
```

`CharacterMotion` supplies speed and accumulated distance. The person renderer composes its face, hair, clothes, footwear and limb poses. Geometry is shared; customized skin/clothing/hair materials belong to the instance and are disposed when replaced. `riding` and `driving` select seated limb poses. Walking height changes at the feet; seated people use the vehicle's fitted dimensions to keep their hands on the steering wheel and their heads below the roof.

People can combine any preset with any hair, face, clothing or footwear option. Family-role presets supply starting appearances; they do not restrict customization. Add presets to `HUMAN_PRESETS`, new selectable parts to the corresponding type and renderer, and labels to `AppearanceSettings`.

`RobotHand` and `RobotLegs` are separately reusable parts. Existing NPC callers can continue passing `palette` and `size` to `RobotCharacter`; the optional `appearance` prop overrides those for configured players.

`Car` shares its wheels, ground contacts, interior and steering mechanism across bodywork variants. `CarBodywork` supplies angular sedan, sport, van and open-bed truck cabins. These are stylized in-game designs, not manufacturer-accurate replicas. All variants fit the existing 1.9 × 3.7 chassis footprint, wheelbase and seat coordinates. A truck omits the rear bench. When adding a physically larger chassis, update collision, ground-contact and steering geometry together rather than scaling only bodywork.

`Car` is a visual component. For a driveable instance, keep its mutable `DriveableCar` state in the driving system, pass it as `motion`, and register ground/collision updates as `GroundedCar` does. `configurePlayerCar` updates the existing summonable car without moving or replacing it. Model/transmission changes are accepted only while that car is unoccupied; the settings UI disables those fields while driving.

Manual controls retain clutch and gears 1–4/N/R. Automatic controls use `selectAutomaticRange` for P/R/N/D, require the brake to engage P/R/D, reject a direction change at speed, and shift forward gears with separate up/down thresholds to avoid oscillation. Keyboard: hold Space and press 1 for D, R for reverse, P for park; N selects neutral. A/D remain steering keys. Automatic driving ignores the clutch. The automatic selector, gear display and 3D clutch pedal reflect the chosen transmission.

Validation:

```text
npm test
npm run build
node tests/appearance.browser.mjs http://127.0.0.1:5173 9334
node tests/carDriving.browser.mjs http://127.0.0.1:5173 9334
```

The browser checks use a dedicated browser context so appearance changes and saved preferences in tests do not overwrite the user's settings.

Grandfather is also available in `HUMAN_PRESETS.grandfather`. Dresses and longyi use a closed, opaque cloth shell from `characterClothing.ts`; covered legs use short steps and expose only the ankles/footwear below the hem. Motorcycle sleeves have capped ends.

Collision damage is shared across travel modes in `rideLife.ts`: walking into a tree or robot pushes the person backward upright by about one step (0.64 metres over 0.5 seconds), without spending life, blinking or showing a warning banner. Houses, fences, gates and other scenery block movement and allow sliding along their edges without recoil. Tree classification shares the trunk bounds in `collision.ts`, including village trees and estate palms. `walkingCollision.ts` sweeps the retreat, stopping early at an obstacle; the person keeps facing the impact direction and animates a backward step. Car contact while walking spends all remaining life; a car crash spends 1.5 of the three lives. Motorcycle damage remains one life. Continuous contact cannot drain life every frame. Damaging impacts retain the existing short protection period; a harmless recoil has only a brief cooldown. `LifeMeter` displays half hearts. `Player` resets riding/driving and returns to the spawn point after a fatal impact.
