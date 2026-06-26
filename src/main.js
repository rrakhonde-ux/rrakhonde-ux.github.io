import './style.css'
import { initStarfield } from './starfield.js'
import { initAstronaut } from './astronaut.js'
import { initBubble, say } from './bubble.js'
import { initPlanets } from './planets.js'

// ─── Page Loader ───
function createLoader() {
  const loader = document.createElement('div')
  loader.id = 'page-loader'
  loader.innerHTML = `
    <div class="loader-inner">
      <img src="/astronaut_loader.png" class="loader-astronaut" alt="astronaut"/>
      <div class="loader-star"></div>
      <p class="loader-text">Preparing your cosmic tour…</p>
    </div>
  `
  document.body.appendChild(loader)
  return loader
}

function hideLoader(loader) {
  loader.classList.add('fade-out')
  setTimeout(() => {
    loader.style.display = 'none'
  }, 600)
}

const loader = createLoader()
let loaderHidden = false

initStarfield()
initBubble()
initPlanets()

function dismissLoader() {
  if (loaderHidden) return
  loaderHidden = true
  hideLoader(loader)

  // Reveal hero photo immediately (especially important on mobile)
  const slot = document.querySelector('#hero-photo-slot')
  if (slot) slot.classList.add('revealed')
}

// Cap loader at 3 seconds regardless of astronaut load state
setTimeout(dismissLoader, 3000)

// When astronaut is ready, dismiss loader (if not already) and start animation
initAstronaut().then(() => {
  dismissLoader()

  const canvas = document.querySelector('#astronaut-canvas')
  if (canvas) {
    canvas.classList.add('wandering')
    startWandering(canvas)
  }

  setTimeout(() => {
    if (window.innerWidth <= 768) return
    say([
      "Hello. I'm here to introduce someone.",
      "Meet Ritesh. Fourteen years of bridging design and business strategy.",
      "He's worked across audit platforms, banking compliance, and child safety systems.",
      "Want me to show you his work?"
    ])
  }, 2000)
})

// ─── Wandering motion: Lissajous within safe bounds + drag-to-move ───
function startWandering(canvas) {
  let dropAnchor = null

  const getSize = () => {
    if (window.innerWidth <= 500) return 110
    if (window.innerWidth <= 768) return 130
    return 260
  }
  let SIZE = getSize()
  window.addEventListener('resize', () => { SIZE = getSize() })

  const isMobile = () => window.innerWidth <= 768

  // On mobile, start astronaut anchored to bottom-right
  if (isMobile()) {
    dropAnchor = {
      x: window.innerWidth - SIZE - 12,
      y: window.innerHeight - SIZE - 12,
    }
  }

  const TOP_GUARD = 80
  let t = 0

  const ax = 0.0007 + Math.random() * 0.0003
  const ay = 0.0005 + Math.random() * 0.0003
  const phase = Math.random() * Math.PI * 2

  // ─── Drag-to-move astronaut (mouse + touch, with mobile corner-snap) ───
  let astroDragging = false
  let astroDragOffset = { x: 0, y: 0 }
  let astroDragPos = null

  const startDrag = (clientX, clientY) => {
    astroDragging = true
    const rect = canvas.getBoundingClientRect()
    astroDragOffset.x = clientX - rect.left
    astroDragOffset.y = clientY - rect.top
    if (!isMobile()) canvas.style.cursor = 'grabbing'
  }

  const moveDrag = (clientX, clientY) => {
    if (!astroDragging) return
    astroDragPos = {
      x: clientX - astroDragOffset.x,
      y: clientY - astroDragOffset.y,
    }
  }

  const endDrag = () => {
    if (!astroDragging) return
    astroDragging = false
    if (!isMobile()) canvas.style.cursor = 'grab'

    if (astroDragPos) {
      if (isMobile()) {
        // Snap to nearest corner on mobile
        const vw = window.innerWidth
        const vh = window.innerHeight
        const PAD = 12
        const left = astroDragPos.x < vw / 2
        const top = astroDragPos.y < vh / 2
        dropAnchor = {
          x: left ? PAD : vw - SIZE - PAD,
          y: top ? 80 : vh - SIZE - PAD,
        }
      } else {
        dropAnchor = { x: astroDragPos.x, y: astroDragPos.y }
      }
    }
    astroDragPos = null
  }

  // Mouse
  canvas.addEventListener('mousedown', (e) => {
    startDrag(e.clientX, e.clientY)
    e.preventDefault()
  })
  window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY))
  window.addEventListener('mouseup', endDrag)

  // Touch
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 0) return
    startDrag(e.touches[0].clientX, e.touches[0].clientY)
    e.preventDefault()
  }, { passive: false })
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length === 0) return
    moveDrag(e.touches[0].clientX, e.touches[0].clientY)
  }, { passive: true })
  window.addEventListener('touchend', endDrag)
  window.addEventListener('touchcancel', endDrag)

  function frame() {
    t += 1

    const vw = window.innerWidth
    const vh = window.innerHeight

    let finalX, finalY

    if (astroDragPos) {
      finalX = Math.max(0, Math.min(vw - SIZE, astroDragPos.x))
      finalY = Math.max(TOP_GUARD, Math.min(vh - SIZE, astroDragPos.y))
    } else if (dropAnchor) {
      // After drop: small local drift around the drop point (not full-viewport wander)
      const driftX = Math.sin(t * 0.015) * 30
      const driftY = Math.cos(t * 0.012) * 20
      finalX = Math.max(0, Math.min(vw - SIZE, dropAnchor.x + driftX))
      finalY = Math.max(TOP_GUARD, Math.min(vh - SIZE, dropAnchor.y + driftY))
    } else {
      const nx = (Math.sin(t * ax + phase) + 1) / 2
      const ny = (Math.sin(t * ay * 1.3) * Math.cos(t * ay * 0.7) + 1) / 2
      const baseX = nx * (vw - SIZE)
      const baseY = TOP_GUARD + ny * (vh - SIZE - TOP_GUARD)
      const scrollDrift = Math.min(window.scrollY * 0.05, 40)
      finalX = baseX
      finalY = Math.max(TOP_GUARD, baseY - scrollDrift)
    }

    canvas.style.transform = `translate(${finalX}px, ${finalY}px)`
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
  const GAP = -60
  const TOP_GUARD = 80
  const vw = window.innerWidth
  const vh = window.innerHeight

  const bw = bubble.offsetWidth || 320
  const bh = bubble.offsetHeight || 80

  let bx = astroX + SIZE + GAP
  let by = astroY + (SIZE / 2) - (bh / 2)

  if (bx + bw > vw - 16) {
    bx = astroX - bw - GAP
  }

  by = Math.max(TOP_GUARD, Math.min(vh - bh - 8, by))
  bx = Math.max(8, Math.min(vw - bw - 8, bx))

  bubble.style.transform = `translate(${bx}px, ${by}px)`
}

// Re-position bubble whenever it becomes visible
const bubbleEl = document.querySelector('#speech-bubble')
if (bubbleEl) {
  const observer = new MutationObserver(() => {
    if (bubbleEl.classList.contains('visible')) {
      const canvas = document.querySelector('#astronaut-canvas')
      if (canvas) {
        const r = canvas.getBoundingClientRect()
        positionBubble(r.left, r.top)
      }
    }
  })
  observer.observe(bubbleEl, { attributes: true, attributeFilter: ['class'] })

  function trackIntro() {
    if (bubbleEl.classList.contains('visible')) {
      const canvas = document.querySelector('#astronaut-canvas')
      if (canvas && !canvas.classList.contains('wandering')) {
        const r = canvas.getBoundingClientRect()
        positionBubble(r.left, r.top)
      }
    }
    requestAnimationFrame(trackIntro)
  }
  requestAnimationFrame(trackIntro)
}

// Skip-to-final on user scroll during intro
let introSkipped = false
window.addEventListener('scroll', () => {
  if (introSkipped) return
  if (window.scrollY < 20) return
  introSkipped = true
  const slot = document.querySelector('#hero-photo-slot')
  if (slot) slot.classList.add('revealed')
}, { passive: true })

// ─── Capability carousel (merry-go-round) ───
startCapabilityCarousel()

function startCapabilityCarousel() {
  const carousel = document.querySelector('#capability-carousel')
  if (!carousel) return
  const cards = Array.from(carousel.querySelectorAll('.cap-card'))
  const total = cards.length

  // Mobile uses native CSS scroll-snap. No JS needed.
  if (window.innerWidth <= 768) return

  // ─── Desktop: merry-go-round arc ───
  const CYCLE_MS = 40000
  const FRONT_BAND = 1.0
  const ARC_HEIGHT = 90
  const ARC_WIDTH_FACTOR = 0.55

  let lastTime = performance.now()
  let progress = 0
  let dragDelta = 0
  let lastFrontIndex = -1

  let isDragging = false
  let dragStartX = 0

  carousel.addEventListener('mousedown', (e) => {
    isDragging = true
    dragStartX = e.clientX
    carousel.classList.add('grabbing')
  })

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartX
    dragStartX = e.clientX
    dragDelta -= dx / carousel.clientWidth
  })

  window.addEventListener('mouseup', () => {
    if (!isDragging) return
    isDragging = false
    carousel.classList.remove('grabbing')
  })

  function frame(now) {
    const delta = now - lastTime
    lastTime = now

    if (!isDragging) progress += delta / CYCLE_MS
    progress += dragDelta
    dragDelta = 0
    progress = ((progress % 1) + 1) % 1

    const w = carousel.clientWidth
    let frontIndex = -1
    let frontProximity = Infinity

    cards.forEach((card, i) => {
      let t = (i / total) - progress
      t = ((t % 1) + 1) % 1

      let x, y, scale, opacity

      if (t < FRONT_BAND) {
        const frontT = t / FRONT_BAND
        const u = -1 + frontT * 2

        x = -u * w * ARC_WIDTH_FACTOR
        y = ARC_HEIGHT * (1 - u * u)
        scale = 0.85 + (1 - Math.abs(u)) * 0.15

        const edgeFade = 0.04
        if (frontT < edgeFade) opacity = frontT / edgeFade
        else if (frontT > 1 - edgeFade) opacity = (1 - frontT) / edgeFade
        else opacity = 1

        const proximity = Math.abs(u)
        if (proximity < frontProximity) {
          frontProximity = proximity
          frontIndex = i
        }
      } else {
        opacity = 0
        scale = 0.5
        x = w
        y = 0
      }

      card.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`
      card.style.opacity = opacity.toFixed(3)
      card.style.zIndex = Math.round((1 - frontProximity) * 50) + (opacity > 0 ? 10 : 0)
    })

    if (frontIndex !== lastFrontIndex) {
      cards.forEach((card, i) => card.classList.toggle('is-front', i === frontIndex))
      lastFrontIndex = frontIndex
    }

    if (frontIndex >= 0) {
      const carouselRect = carousel.getBoundingClientRect()
      const carouselInView = carouselRect.bottom > 0 && carouselRect.top < window.innerHeight
      if (carouselInView) {
        const rect = cards[frontIndex].getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        if (window.__astronautLookAt) window.__astronautLookAt(cx, cy)
      } else if (window.__astronautLookAt) {
        window.__astronautLookAt(null)
      }
    }

    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}

// ─── Other projects: collapse + filter ───
const INITIAL_VISIBLE = 4
let isExpanded = false
let currentFilter = 'all'

function applyVisibility() {
  const cards = Array.from(document.querySelectorAll('.other-card'))
  let shown = 0
  cards.forEach(card => {
    const matchesFilter = currentFilter === 'all' || card.dataset.category === currentFilter
    card.classList.toggle('hidden', !matchesFilter)

    if (currentFilter !== 'all') {
      card.classList.remove('collapsed-hidden')
    } else if (!isExpanded) {
      const shouldHide = shown >= INITIAL_VISIBLE
      card.classList.toggle('collapsed-hidden', shouldHide)
      if (!shouldHide) shown++
    } else {
      card.classList.remove('collapsed-hidden')
    }
  })

  const btn = document.querySelector('#show-more-btn')
  if (btn) {
    btn.style.display = currentFilter === 'all' ? '' : 'none'
    btn.textContent = isExpanded ? 'Show less' : 'Show all'
  }
}

document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    currentFilter = tab.dataset.filter
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t === tab))
    applyVisibility()
  })
})

const showBtn = document.querySelector('#show-more-btn')
if (showBtn) {
  showBtn.addEventListener('click', () => {
    const wasExpanded = isExpanded
    isExpanded = !isExpanded
    applyVisibility()

    if (!wasExpanded) {
      setTimeout(() => {
        const cards = document.querySelectorAll('.other-card:not(.hidden)')
        const firstNew = cards[INITIAL_VISIBLE]
        if (firstNew) {
          const rect = firstNew.getBoundingClientRect()
          const offset = window.scrollY + rect.top - 100
          window.scrollTo({ top: offset, behavior: 'smooth' })
        }
      }, 300)
    } else {
      setTimeout(() => {
        const grid = document.querySelector('.other-grid')
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  })
}

applyVisibility()