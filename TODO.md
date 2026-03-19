# TODO

- **Angle-dependent pocket target**: The effective target area should vary based on the angle
  at which the object ball approaches the pocket. A ball traveling toward the pocket along the
  rail sees a different (narrower) opening than a ball coming from the middle of the table.
  The current model uses a fixed 2.5" effective opening regardless of approach angle.

- **Cut-induced throw**: Friction between the cue ball and object ball at impact deflects the
  object ball slightly off the pure geometric line (throw). The magnitude depends on cut angle
  and spin. Need to work out how to represent this in the UI — it affects the object ball's
  travel direction and thus the make probability, but the interaction with the existing error
  cone visualization needs thought.
