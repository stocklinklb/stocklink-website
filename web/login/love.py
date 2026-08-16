import turtle
import math

# Setup the screen correctly
screen = turtle.Screen()
screen.bgcolor("black")
t = turtle.Turtle()

# Configuration
t.speed(0)          # Set to 0 (fastest) so the animation finishes quickly
t.hideturtle()      # Fixed syntax typo from '1.hideturtle()'
t.penup()
t.color("#ffb6c1")

# Drawing loop
for scale in range(11, 17):
    for i in range(120):
        angle = i * (math.pi * 2) / 120
        
        # Calculate heart shape coordinates
        x = 16 * (math.sin(angle) ** 3) * scale
        
        # Fixed 'match' to 'math' and fixed operator typos
        y = (12 * math.cos(angle) - 5 * math.cos(2 * angle) - 2 * math.cos(3 * angle) - math.cos(4 * angle)) * scale
        
        t.goto(x, y)
        t.write("I love you", align="center", font=("Arial", 8, "bold"))

# Keep window open (Moved outside of the for loops)
turtle.done()
