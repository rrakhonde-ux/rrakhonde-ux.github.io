import './style.css'
import { initStarfield } from './starfield.js'
import { initAstronaut } from './astronaut.js'
import { initBubble, say } from './bubble.js'

initStarfield()
initBubble()

initAstronaut().then(() => {
  const canvas = document.querySelector('#astronaut-canvas')
  if (canvas) {
    canvas.classList.add('wandering')
    startWandering(canvas)
  }

  setTimeout(() => {
    say([
      "Hello. I'm here to introduce someone.",
      "Meet Ritesh. Fourteen years of bridging design and business strategy.",
      "He's worked across audit platforms, banking compliance, and child safety systems.",
      "Want me to show you his work?"
    ])
  }, 2000)
})

// ─── Wandering motion: Lissajous within safe bounds ───
function startWandering(canvas) {
  const getSize = () => {
    if (window.innerWidth <= 500) return 140
    if (window.innerWidth <= 768) return 180
    return 260
  }
  let SIZE = getSize()
  window.addEventListener('resize', () => { SIZE = getSize() })
  const TOP_GUARD = 80   // stay below nav
  let t = 0

  const ax = 0.0007 + Math.random() * 0.0003
  const ay = 0.0005 + Math.random() * 0.0003
  const phase = Math.random() * Math.PI * 2

  function frame() {
    t += 1

    const vw = window.innerWidth
    const vh = window.innerHeight

    const nx = (Math.sin(t * ax + phase) + 1) / 2
    const ny = (Math.sin(t * ay * 1.3) * Math.cos(t * ay * 0.7) + 1) / 2

    const baseX = nx * (vw - SIZE)
    const baseY = TOP_GUARD + ny * (vh - SIZE - TOP_GUARD)

    // Slight scroll drift (stays in view always)
    const scrollDrift = Math.min(window.scrollY * 0.05, 40)

    const finalX = baseX
    const finalY = Math.max(TOP_GUARD, baseY - scrollDrift)

    canvas.style.transform = `translate(${finalX}px, ${finalY}px)`

    // Update bubble position to follow astronaut
    positionBubble(finalX, finalY)

    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}

// ─── Bubble follows astronaut (left or right only) ───
function positionBubble(astroX, astroY) {
  const bubble = document.querySelector('#speech-bubble')
  if (!bubble || !bubble.classList.contains('visible')) return

  const SIZE = window.innerWidth <= 500 ? 140 : window.innerWidth <= 768 ? 180 : 260
  const GAP = 12
  const TOP_GUARD = 80
  const vw = window.innerWidth
  const vh = window.innerHeight

  const bw = bubble.offsetWidth || 320
  const bh = bubble.offsetHeight || 80

  // Default: right of astronaut, vertically centered
  let bx = astroX + SIZE + GAP
  let by = astroY + (SIZE / 2) - (bh / 2)

  // Flip to left if would overflow right edge
  if (bx + bw > vw - 16) {
    bx = astroX - bw - GAP
  }

  // Clamp to viewport vertically
  by = Math.max(TOP_GUARD, Math.min(vh - bh - 8, by))

  // Clamp to viewport horizontally
  bx = Math.max(8, Math.min(vw - bw - 8, bx))

  bubble.style.transform = `translate(${bx}px, ${by}px)`
}