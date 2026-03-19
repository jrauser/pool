# Pool Shot Margin Visualizer

An interactive web page that builds visual intuition for the mathematics of pool shot execution error. Based on the analysis in *TP_3-4.pdf*.

## What it does

The page shows a 9-foot pool table with a cue ball and object ball. A slider controls **Δφ**, the 95% confidence interval of the shooter's execution error (assumed Gaussian). As you move the slider:

- The **blue cone** (±Δφ) shows the spread of possible cue-ball directions
- The **red cone** (±Δθ) shows the resulting spread in the object ball's direction
- The **make probability** updates live

## The math

Given a cut angle φ, shot distance d, and execution error Δφ, the angular error in the object ball's direction is (from TP_3-4.pdf, valid when d >> R):

```
Δθ(d, φ, Δφ) = φ − Δφ + arcsin( (d / 2R)·sin(Δφ) − sin(φ − Δφ) )
```

where R = 1.125" (ball radius). The pocket has a 4.5" mouth (BCA standard) with an effective target width of 2.5". Make probability is computed from the Gaussian CDF.

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

All math functions live in `pool.js` and are unit-tested in `pool.test.js` at 100% coverage.

## Possible future extensions

- Draggable ball positions
- Cut-induced throw (friction)
- Side spin and spin-induced throw
- Squirt and swerve
