import './style.css'
import { initStarfield } from './starfield.js'
import { initAstronaut } from './astronaut.js'
import { initBubble, say } from './bubble.js'

initStarfield()
initBubble()

initAstronaut().then(() => {
  // Astronaut is now visible — start the intro
  setTimeout(() => {
    say([
      "Hello. I'm here to introduce someone.",
      "Meet Ritesh. Fourteen years of bridging design and business strategy.",
      "He's worked across audit platforms, banking compliance, and child safety systems.",
      "Want me to show you his work?"
    ])
  }, 600)
})