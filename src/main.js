import './style.css'
import { initStarfield } from './starfield.js'
import { initAstronaut } from './astronaut.js'
import { initBubble, say } from './bubble.js'

initStarfield()
initAstronaut()
initBubble()

// TEMPORARY — test the bubble system. Will be replaced by real choreography in Phase 4.
setTimeout(() => {
  say([
    "Hello. I'm here to introduce someone.",
    "Meet Ritesh. Fourteen years of bridging design and business strategy.",
    "He's worked across audit platforms, banking compliance, and child safety systems.",
    "Want me to show you his work?"
  ])
}, 2000)