# Thadingyut candles

Open `/candle-preview.html` to orbit the three models independently and compare day/night lighting. The gold cup, white dotted rim and purple wax pool follow `candle.png`.

`src/components/Candle.tsx` exports `Candle`, `CandleHolder` (empty), and `CandleInHolder`. Position is the supporting surface, in metres. Each accepts `position` and uniform `scale`; candles also accept `lit`. Mount one `CandleAnimation` per Canvas.

```tsx
<CandleAnimation />
<Candle position={[0, 1.475, 0]} />
<CandleHolder position={[1, 0, 0]} />
<CandleInHolder position={[0, .88, 0]} />
```

World decoration uses `FestivalAnchor`, `CandleRow` and `PorchCandles` inside each house's actual local transform. Rows are spaced approximately 55 cm apart on stationary fence rails; doors/gate openings remain clear. Cups sit on porch decks and selected existing dining/kitchen tables. Generic town/village houses, the player farmhouse, U Shwe's house, Kanbale/Nat Myaung houses and Shwe Myanmar residences are decorated. Moving gates do not carry candles.

`RegionBuilder` converts those markers to instanced geometry in 64 m tiles before the startup GPU warm-up. Active cached regions render detailed candles, while detached regions retain lightweight light markers on the simplified overview houses. Distance detail keeps both flames and glows and expands the viewing range with camera height. The flame and glow shaders use the same logarithmic depth convention as the game, so foreground surfaces do not incorrectly hide them. Screen-facing glows maintain a small six-pixel diameter at aerial distances, including straight-down views. Real walls still occlude detailed candles normally.

The flames sway and flicker in a shared GPU shader, including after a cached region is restored; there are no per-candle React frame callbacks. A bounded pool of reused, shadow-free lights illuminates nearby surfaces at night. Day/night uses the existing game setting.

Validation: `node --experimental-strip-types --test tests/candles.test.ts`, `npm run build`; browser verification is in `scripts/verifyCandles.mjs`. The browser regression measures rendered pixels with logarithmic depth enabled for individual and instanced candles from four sides, directly overhead, and 1200 metres above.
