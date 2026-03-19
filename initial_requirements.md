
The document TP_3-4.pdf contains a mathematical analysis of the margin for error of a pool shot based on distance and cut angle.  I would like to make a web page that gives the viewer visual intuition for the mathematics.

Here's the key result.  A ball has radius $R$ = 1.125 inches.  $d$ is the distance between the cue ball and object ball.  The intended object ball direction is $\theta$.  The cut angle, that is the angle between the cue ball and $\theta$ is $\phi$.  The shooter has some execution error given by $\Delta\phi$. If you assume $d >> R$, then the error in the object ball direction $\Delta\theta$ is given by:

$\Delta\theta(d, \phi, \Delta\phi) = \phi - \Delta\phi + asin(\frac{d}{2R} sin(\Delta\phi) - sin(\phi-\Delta\phi))$

(I hope I entered that correctly!!)

The page would show a pool table.  Let's say it's the standard dimensions of a 9 foot table.  As a first pass it can simply be drawn as a rectangle.  The target pocket is in the upper right corner.  The target area can be shown with another rectangle.  As a first pass let's say the effective size of the pocket is 2.5 inches (4.5 inches minus 2 inches as suggested by the pdf).  The cue ball and object ball are standard size and are shown as filled circles.  Maybe the user can drag the balls around on the table, but as a first pass I'll take a static setup.

If one assumes no friction between the balls, from the above it is easy to calculate the angle to shoot the cue ball so as to pocket the object ball.  The problem, of course is that the shooter has some execution error, this is $\Delta\phi$ in the paper.  I'd like it if there were a slider on the side of the screen that controls $\Delta\phi$.  The range is from zero to, say, 2 degrees.  The scale might need to be logarithmic?

As the user slides the slider, a shaded region grows or shinks between the cue ball and the object ball and the object ball and the pocket.  Let's say that the shooter's execution error is Gaussian, with mean zero and a 95% coverage interval given by the slider.  Now you can calculate the percentage of time you make the ball (the center of the ball passes through the target).

In the future we might add friction and therefore the effect of cut induced throw.  Even further in the future we might add side spin and spin induced throw.  In the even further future, maybe quirt and swerve, but these seem difficult to model.

# Corner pocket rendering

The [BCA specifies](https://www.classicbilliards.net/cushions-supplies/bca-pocket-specs.html) that the mouth of a pocket is between 4 1/8" and 5 1/8".  Let's say our pockets are the standard 4 1/2".  The angle between the rail and the pocket facing is specificed to be 142 degrees.  This gives the position and orientation of the target area.  As discussed above we'll say the target is 2.5 inches wide.  In the future we might account for the fact that the target width changes as the ball entrance angle varies.  