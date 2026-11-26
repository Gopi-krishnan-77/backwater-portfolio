// Live car pose, written by the car every frame and read by the sun, GPS, minimap and markers.
// Kept outside React so readers don't re-render 60 times a second.
import { Vector3 } from 'three'
import { START } from './layout'

export const playerPosition = new Vector3(...START)
export const playerHeading = { value: Math.PI } // radians; 0 faces +z (south), PI faces -z (north)
