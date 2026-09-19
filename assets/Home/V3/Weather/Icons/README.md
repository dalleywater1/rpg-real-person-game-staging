# Weather icon family — production candidate

All twelve icons are rebuilt as a single family. This package is an art candidate, not a Weather freeze. Old runtime icons must remain active until the replacement family passes visual and live QA; archive them when switching, rather than deleting them.

Candidate D records a measured 38×38px icon at 320. It is a sandbox composition, fully reverted, not evidence of a deployed layout. 375/580 icon sizes remain unconfirmed. Export 38px and 76px for the measured slot; do not change geometry to fit exports.

## Canonical mapping contract

Use provider codes and an explicit day/night indicator. Do not infer night from cloud cover or parse localized display strings. The provider has not been identified in this brief, so this table specifies semantic mapping, not verified provider-code coverage.

| Canonical ID | Conditions |
|---|---|
| clear-day | Clear, sunny; daytime |
| clear-night | Clear; nighttime |
| partly-cloudy-day | Few/scattered clouds, fair; daytime |
| partly-cloudy-night | Few/scattered clouds, fair; nighttime |
| cloudy | Cloudy, broken cloud, overcast |
| light-rain | Drizzle, light rain, light/scattered/intermittent showers |
| heavy-rain | Moderate/heavy rain, heavy showers, downpour |
| thunderstorm | Thunder, lightning, thunderstorm with any precipitation |
| snow | Snow, flurries, snow showers |
| sleet | Sleet, rain/snow mix, freezing rain, ice pellets |
| fog | Fog, mist, haze |
| windy | Explicit windy/gusty condition without a more specific precipitation condition |

For compound conditions use precedence: thunderstorm → sleet → snow → heavy rain → light rain → fog → explicit windy → cloud cover → clear day/night. Wind speed alone must not replace a precipitation icon. Hail with thunder maps to thunderstorm; hail without thunder maps to sleet as the closest available frozen-precipitation symbol, a documented simplification. Missing/unrecognized data may use cloudy as a neutral art fallback while live text says unavailable; log unmapped codes. Preserve original provider text and measurements.

Astra must return the actual provider-code lookup with coverage for every documented provider code, day/night cases, and unknown codes before retiring the old runtime family.

## Review gate

Review all twelve at 38px on the actual navy HUD over Day/Sunset/Night/Rain. Check light versus heavy rain, day versus night partly-cloudy, snow versus sleet, and fog versus cloudy. Keep live values, labels and Running Conditions separate. Confirm alpha, identical canvas size, consistent optical scale, clean edges and no baked scenery. After visual approval, integrate the whole family together with one naming convention and mapping table.

## Export verification

Delivered: twelve 1024×1024 transparent PNG masters and twelve each at 38×38 and 76×76. All 36 assets have transparent corner pixels. The family-review sheet was visually inspected on navy at 38px; identities remain distinguishable, including the rain pair and snow/mix pair. This is static review, not live HUD or four-environment QA. No minimum smaller than 38 CSS pixels is asserted. All assets share a square canvas; generated silhouettes retain their natural aspect ratio. Archive originals remain at their generation paths; normalized exports are the package masters.
