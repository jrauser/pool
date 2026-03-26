# Plan v3.2.1: Arc Length Output

## Goal

Add a new row to the outputs grid showing the arc length (in mm) swept by the ±Δφ execution error cone at the object ball distance. This gives a tangible, physical-units sense of aiming precision — more intuitive than degrees alone.

## Math

```
arc_mm = 2 × deltaPhiRad × d_inches × 25.4
```

where `deltaPhiRad = (deltaPhiDeg × π / 180)` and `d` is the CB-to-OB distance in inches.
The factor of 2 accounts for ±Δφ (both sides of center).

## Files to Change

- `index.html` — add one `.info-row` to `#outputs-grid`
- `pool.js` — wire up the new elements and compute arc length in two places

## Changes

### index.html

Add a sixth `.info-row` inside `#outputs-grid` (after the Throw row). The label uses a nested `<span>` for just the Δφ number so the `info-btn` sibling is never clobbered by JS:

```html
<div class="info-row">
  <span class="info-label">Arc length of ±<span id="label-arc-deltaphi">—</span>° at OB
    <span class="info-btn" data-info="The physical spread of the ±Δφ execution error cone, measured at the object ball distance. Equal to 2 × Δφ × d (converted to mm). Gives a concrete sense of aiming precision.">&#9432;</span>
  </span>
  <span id="display-arc-length" class="info-value">—</span>
</div>
```

### pool.js

**Element references** (near line 820, with the other display element refs):
```js
const displayArcLength = document.getElementById('display-arc-length');
const labelArcDeltaPhi = document.getElementById('label-arc-deltaphi');
```

**`updateSlider()` — normal case** (after the existing `displayThrow.textContent` line ~1073):
```js
const arcMm = 2 * deltaPhiRad * d * 25.4;
labelArcDeltaPhi.textContent = deltaPhiDeg.toFixed(2);
displayArcLength.textContent = arcMm.toFixed(1) + ' mm';
```

**`redraw()` — degenerate case** (after the existing `displayThrow.textContent = '—'` line ~1138):
```js
const sliderVal = parseFloat(slider.value);
const sliderRad = (sliderVal * Math.PI) / 180;
const arcMm = 2 * sliderRad * d * 25.4;
labelArcDeltaPhi.textContent = sliderVal.toFixed(2);
displayArcLength.textContent = arcMm.toFixed(1) + ' mm';
```

(`d` is already computed in `redraw()` scope.)

## Notes

- Arc length is well-defined even for degenerate shots (φ ≥ 90°), so it shows in both cases.
- No changes to math modules, CSS, or tests needed.
- `deltaPhiRad` is already computed at the top of `updateSlider()` (~line 1000), so no extra conversion is needed there.

## What Is NOT Changing

- All math functions and physics models.
- The existing output rows and their info popups.
- Tests (pure rendering change, browser-only code).

## Verification

1. `npm start`, open http://localhost:8080
2. Confirm the new row appears in the outputs section with the ⓘ icon
3. Drag balls to a known distance (e.g. CB at [20,25], OB at [50,25] → d = 30")
4. Set slider to 1.00° → arc should be `2 × (π/180) × 30 × 25.4 ≈ 26.6 mm`
5. Verify label reads "Arc length of ±1.00° at OB" and value reads "26.6 mm"
6. Confirm both update live as slider moves and balls are dragged
7. Force φ ≥ 90° — verify arc length still shows a value (not "—")
8. Click the ⓘ icon and verify the popup appears with correct text
