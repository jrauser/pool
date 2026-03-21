# TODO

- **A question**: Practically, when I set up a long thin cut, say with the OB half a ball off the rail at the third diamond, and the CB in the center of the table, I miss much more often on the too-full side -- the OB hits the long rail and rebounds outside of the mouth of the pocket.  I think this suggests that I systematically undercompensate for CIT.  But maybe my execution error on thin cuts is biased toward the too full side?  I guess that's indistinguishable from a systematic undercompensation for CIT.  It's interesting.

# Done

- **Symmetric OB error cone bug**: The OB error cone used `deltaTheta(d, phi, +Δφ)`
  as a symmetric half-angle for both sides. But the Δφ→Δθ mapping is nonlinear —
  `|Δθ(+Δφ)| ≠ |Δθ(-Δφ)|` — so one side of the cone was wildly overstated.
  On thin cuts with max error, the wrong-side Δθ reached 80°+, producing an
  absurdly wide cone. Fixed by computing both edges independently and drawing
  an asymmetric cone. Domain boundary hits (CB misses OB) are capped at the
  boundary Δθ value.

- **Angle-dependent pocket target**: The effective target area should vary based on the angle
  at which the object ball approaches the pocket. A ball traveling toward the pocket along the
  rail sees a different (narrower) opening than a ball coming from the middle of the table.
  The current model uses a fixed 2.5" effective opening regardless of approach angle.

- **Cut-induced throw**: Friction between the cue ball and object ball at impact deflects the
  object ball slightly off the pure geometric line (throw). The magnitude depends on cut angle
  and spin. Need to work out how to represent this in the UI — it affects the object ball's
  travel direction and thus the make probability, but the interaction with the existing error
  cone visualization needs thought.
