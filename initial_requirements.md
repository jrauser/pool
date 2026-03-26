# V1 sketch

The document TP_3-4.pdf contains a mathematical analysis of the margin for error of a pool shot based on distance and cut angle.  I would like to make a web page that gives the viewer visual intuition for the mathematics.

Here's the key result.  A ball has radius $R$ = 1.125 inches.  $d$ is the distance between the cue ball and object ball.  The intended object ball direction is $\theta$.  The cut angle, that is the angle between the cue ball and $\theta$ is $\phi$.  The shooter has some execution error given by $\Delta\phi$. If you assume $d >> R$, then the error in the object ball direction $\Delta\theta$ is given by:

$\Delta\theta(d, \phi, \Delta\phi) = \phi - \Delta\phi + asin(\frac{d}{2R} sin(\Delta\phi) - sin(\phi-\Delta\phi))$

(I hope I entered that correctly!!)

The page would show a pool table.  Let's say it's the standard dimensions of a 9 foot table.  As a first pass it can simply be drawn as a rectangle.  The target pocket is in the upper right corner.  The target area can be shown with another rectangle.  As a first pass let's say the effective size of the pocket is 2.5 inches (4.5 inches minus 2 inches as suggested by the pdf).  The cue ball and object ball are standard size and are shown as filled circles.  Maybe the user can drag the balls around on the table, but as a first pass I'll take a static setup.

If one assumes no friction between the balls, from the above it is easy to calculate the angle to shoot the cue ball so as to pocket the object ball.  The problem, of course is that the shooter has some execution error, this is $\Delta\phi$ in the paper.  I'd like it if there were a slider on the side of the screen that controls $\Delta\phi$.  The range is from zero to, say, 2 degrees.  The scale might need to be logarithmic?

As the user slides the slider, a shaded region grows or shinks between the cue ball and the object ball and the object ball and the pocket.  Let's say that the shooter's execution error is Gaussian, with mean zero and a 95% coverage interval given by the slider.  Now you can calculate the percentage of time you make the ball (the center of the ball passes through the target).

In the future we might add friction and therefore the effect of cut induced throw.  Even further in the future we might add side spin and spin induced throw.  In the even further future, maybe quirt and swerve, but these seem difficult to model.

## Corner pocket rendering

The [BCA specifies](https://www.classicbilliards.net/cushions-supplies/bca-pocket-specs.html) that the mouth of a pocket is between 4 1/8" and 5 1/8".  Let's say our pockets are the standard 4 1/2".  The angle between the rail and the pocket facing is specificed to be 142 degrees.  This gives the position and orientation of the target area.  As discussed above we'll say the target is 2.5 inches wide.  In the future we might account for the fact that the target width changes as the ball entrance angle varies.  

# V2: Draggable balls

Version 2 was draggable balls.  See plan_v2.md.

# V2.1: dynamic pocket size

The size, orientation and position of the target area changes with the position of the object ball as described in TP3-5.pdf and TP3-6.pdf.

Separately, I've had Claude translate these into markdown specifications corner_pocket_target_size_spec.md, which refernces side_pocket_target_size_spec.md.  

I'd like the target area's size, position and orientation to update as the user drags the object ball around.  

# V3: Collision induced throw

For this version I'd like to include the impact of collision induced throw (CIT). There is a markdown translation of TP_A-14 in object_ball_throw_spec.md.  For simplicity we'll only account for the natural roll case.

## Shot speed

Shot speed has a large impact of CIT.  Let's introduce a toggle for speed, slow, medium, fast using the numbers from the report.

## Player accuracy

I'm not 100% sure how to handle the question of player accuracy when estimating the effect of CIT, but here is my best shot.  First we need a toggle that controls whether the aim point is adjusted for CIT.  When off, the aim point is as though CIT doesn't exist, and when on it perfectly compensates for CIT.  This lets the user explore the impact of CIT on different shots.

Next we need a new slider, which is the shooter's accuracy in adjusting for CIT, in degrees, just like the first slider.  As with the first slider, we assume a Guassian error with zero mean, and the slider's value gives a 95% coverage interval.  This, of course, is generous.  Players probably systematically undercompensate for CIT.

I'm not certain if the error cones remain the same -- that is a single cone from CB to OB and from OB to pocket, or if the error from stroke and CIT should be shown visually.

# V3.1: Side Pocket

I'd like to add a side pocket to the table and leverage the side pocket sizing spec in `reference/side_pocket_target_size_spec.md`.  Again referring to the [BCA spec](https://www.classicbilliards.net/cushions-supplies/bca-pocket-specs.html) a side pocket mouth can be between 4 7/8" and 5 5/8".  Let's say ours are 5".  The facing angles are 103 degrees.

To begin let's the render one side pocket on the top of the table.  Add a toggle that aims for that pocket vs the corner, and does all the attendant math to compute the target area.

Let me test, and then as a final step we can render all the pockets on the table by means of rotation/reflection.  Id also like to add diamonds to the table.  A standard pool table has three diamond between any pair of pockets.  They are placed 1/4, 1/2 and 3/4 of the distance between the pockets.

# V3.2: Visual redesign

I'd like to rearrange the components of the app. Instead of two columns, I'd like a single column.  Starting from the top:


* Make Percentage: ###.#%

* The Pool Table (the color legend is overlaid on the pool table in the lower left)

* The controls in two columns:
  * Target pocket | Shot speed
  *  Execution error slider | Corect for throw
  *                     | Throw correction slider

* The outputs in two columns:

Notice that the title "Pool Shot Margin Visualizer" is gone.

I'm going to want to make this work on mobile, so the more compact the better.  It's ok if there are two different layouts: more generous on dekstop, more compact on mobile.

# V3.2.1: Minor tweaks

I'd like to add one more value to the output section at the bottom: the arclength of the error cone at the object ball in millimeters.  The label can be "Arc length of +- #.# degrees at OB: ##.# mm" where the first variable is from the execution error slider, and the second is the arclength at the distance between the CB and OB.

A small nit: In the browser, if you drag a ball outside of the pool table area, you "let go" of it.  That is, the ball stops moving and even if you bring your mouse back into the table's area the ball won't move.  This doesn't happen on mobile.  

# V3.3: Add sight picture

I'd like to add a "sight picture" showing the overlap between the object ball and cue ball based on the cut angle.  That is, the image you would see along the CB's line at the moment of contact.  This would live in the upper left, below the make probability readout.  

Additionally, there should be two rectangles. First, a blue rectangle showing the size of the cue ball execution error cone at the moment of contact.  Second, a yellow rectangle showing the size of the target area on the object ball, again from along the cue ball's line of aim (that is, from the shooter's point of view).  So, for a thin cut, this target size rectangle would be very small (being viewed at an angle).

The two rectangles stack on top of each other.  The top one being the target area and the bottom the CB error cone.  Like this, centered vertically on the CB/OB overlap sight picture:

    <--->
<---------->  

The colors (blue and yellow) match with the color of the cue ball error cone and packet window respectively.  Because the object ball right now is yellow we need to pick a different color for it.  Maybe red?

