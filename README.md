# Pool Shot Margin Visualizer

An interactive web page that builds visual intuition for the mathematics of pool shot execution error. Based on analyses in *reference/TP_3-4.pdf*, *reference/TP_3-5.pdf*, *reference/TP_3-6.pdf*, and *reference/TP_A-14.pdf*.

## What it does

The page shows a 9-foot pool table with a draggable cue ball and object ball. A slider controls **Δφ**, the 95% confidence interval of the shooter's execution error (assumed Gaussian). As you move the slider or drag the balls:

- The **blue cone** (±Δφ) shows the spread of possible cue-ball directions
- The **red cone** (±Δθ) shows the resulting spread in the object ball's direction
- The **yellow target line** shows the effective pocket opening for the current approach angle
- The **make probability** updates live

### Pocket selection

A toggle switches between the **upper-right corner pocket** and the **top-center side pocket**. Each pocket type uses its own target-size model (TP 3.6 for corners, TP 3.5 for sides) with different geometry: mouth width, facing angles, and pocketing mechanisms. The side pocket model accounts for point deflection and wall deflection; the corner pocket model additionally handles rail deflection and multi-wall rattles.

### Collision-induced throw (CIT)

Friction during the collision deflects the object ball away from the theoretical cut-angle direction. The effect is speed-dependent — slower shots throw more. Three controls manage this:

- **Shot speed toggle** (slow / medium / fast): selects 1, 3, or 7 mph
- **Adjust aim for throw checkbox**: when off, the aim point ignores throw and the travel line visibly misses the pocket; when on, the aim point compensates perfectly for throw on average
- **Throw compensation accuracy slider**: the 95% CI of the player's compensation accuracy as a percentage of the throw angle

## Running

No build step required. Serve the directory over HTTP (required for ES module imports):

```
npm start
```

Then open **http://localhost:8080** in your browser.

## Development

```
npm test         # run unit tests (Vitest)
npm run coverage # test with coverage report
```

Math functions are split across `pool.js`, `pocket_geometry.js`, and `throw.js`, each with a corresponding test file.

## Credits

The underlying math is from the billiards physics research of [Dr. Dave Alciatore](https://www.engr.colostate.edu/~dga/bio/publications/#Research) (Colorado State University).

## Possible future extensions

- Render all six pockets and diamond markers
- Sidespin / spin-induced throw
- Stun and draw spin states
- Squirt and swerve
