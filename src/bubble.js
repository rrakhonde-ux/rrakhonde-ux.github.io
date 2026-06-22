// Speech Bubble System — manages dialog display, typewriter, history, section context

let currentTypewriter = null
let autoAdvanceTimer = null
let history = []           // all messages ever shown
let historyIndex = -1      // which message is currently displayed
let queue = []             // upcoming auto-advance messages
let manualMode = false     // true once user clicks ← or →
let currentSection = 'hero'

const TYPEWRITER_SPEED = 28      // ms per character
const READ_PAUSE = 2800           // ms to pause after typing completes before auto-advance

// Contextual lines per section — astronaut speaks the recruiter's language
const SECTION_LINES = {
  hero: "Want to see what he's built?",
  about: "Fourteen years of bridging design and business strategy.",
  work: "Six worlds. Six problems he made simpler.",
  contact: "Want to build something together? After you.",
}

// ─────────────────────────────────────────
// Initialize
// ─────────────────────────────────────────

export function initBubble() {
  const bubble = document.querySelector('#speech-bubble')
  if (!bubble) return

  const closeBtn = bubble.querySelector('.bubble-close')
  const prevBtn = bubble.querySelector('.bubble-prev')
  const nextBtn = bubble.querySelector('.bubble-next')

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    dismissBubble()
  })

  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    showPrevious()
  })

  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    showNext()
  })

  // Click anywhere on bubble (except buttons) to skip typewriter
  bubble.addEventListener('click', () => {
    if (currentTypewriter) finishTypewriterEarly()
  })

  // Click on astronaut canvas to re-engage with contextual line
  const astronautCanvas = document.querySelector('#astronaut-canvas')
  if (astronautCanvas) {
    astronautCanvas.addEventListener('click', () => {
      const line = SECTION_LINES[currentSection] || SECTION_LINES.hero
      say(line)
    })
  }

  // Set up section detection
  setupSectionObserver()
}

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────

// Show a message or array of messages on the bubble
export function say(messages, options = {}) {
  const list = Array.isArray(messages) ? messages : [messages]

  // Fresh say() resets manual mode — auto-advance resumes
  manualMode = false

  queue = [...list]
  playNext()
}

export function dismissBubble() {
  const bubble = document.querySelector('#speech-bubble')
  if (currentTypewriter) {
    clearInterval(currentTypewriter)
    currentTypewriter = null
  }
  clearTimeout(autoAdvanceTimer)
  bubble.classList.remove('visible')
  manualMode = false
}

// ─────────────────────────────────────────
// Internal — queue, history, typewriter
// ─────────────────────────────────────────

function playNext() {
  if (queue.length === 0) {
    // Queue done — schedule auto-dismiss after READ_PAUSE
    clearTimeout(autoAdvanceTimer)
    autoAdvanceTimer = setTimeout(() => {
      if (!manualMode) dismissBubble()
    }, READ_PAUSE)
    return
  }

  const message = queue.shift()
  showMessage(message)
}

function showMessage(text) {
  const bubble = document.querySelector('#speech-bubble')
  const textEl = bubble.querySelector('.bubble-text')

  // Trigger photo reveal when "Meet Ritesh" line plays
  if (text.startsWith('Meet Ritesh')) {
    const slot = document.querySelector('#hero-photo-slot')
    if (slot) slot.classList.add('revealed')
  }

  // Record in history
  history.push(text)
  historyIndex = history.length - 1
  updateNavButtons()

  bubble.classList.add('visible')

  // Clear any in-flight typewriter
  if (currentTypewriter) {
    clearInterval(currentTypewriter)
    currentTypewriter = null
  }
  textEl.textContent = ''

  // Type out the new message
  let i = 0
  currentTypewriter = setInterval(() => {
    if (i < text.length) {
      textEl.textContent += text.charAt(i)
      i++
    } else {
      clearInterval(currentTypewriter)
      currentTypewriter = null
      // Schedule next in queue (if not in manual mode) after READ_PAUSE
      clearTimeout(autoAdvanceTimer)
      if (!manualMode) {
        autoAdvanceTimer = setTimeout(playNext, READ_PAUSE)
      }
    }
  }, TYPEWRITER_SPEED)
}

function finishTypewriterEarly() {
  if (!currentTypewriter) return
  const bubble = document.querySelector('#speech-bubble')
  const textEl = bubble.querySelector('.bubble-text')

  clearInterval(currentTypewriter)
  currentTypewriter = null
  textEl.textContent = history[historyIndex]

  clearTimeout(autoAdvanceTimer)
  if (!manualMode) {
    autoAdvanceTimer = setTimeout(playNext, READ_PAUSE)
  }
}

// ─────────────────────────────────────────
// Manual navigation (← and →)
// ─────────────────────────────────────────

function showPrevious() {
  if (historyIndex <= 0) return

  manualMode = true
  clearTimeout(autoAdvanceTimer)
  if (currentTypewriter) {
    clearInterval(currentTypewriter)
    currentTypewriter = null
  }

  historyIndex--
  const bubble = document.querySelector('#speech-bubble')
  const textEl = bubble.querySelector('.bubble-text')
  textEl.textContent = history[historyIndex]

  updateNavButtons()
}

function showNext() {
  if (historyIndex >= history.length - 1) return

  manualMode = true
  clearTimeout(autoAdvanceTimer)
  if (currentTypewriter) {
    clearInterval(currentTypewriter)
    currentTypewriter = null
  }

  historyIndex++
  const bubble = document.querySelector('#speech-bubble')
  const textEl = bubble.querySelector('.bubble-text')
  textEl.textContent = history[historyIndex]

  updateNavButtons()
}

function updateNavButtons() {
  const bubble = document.querySelector('#speech-bubble')
  const prevBtn = bubble.querySelector('.bubble-prev')
  const nextBtn = bubble.querySelector('.bubble-next')

  prevBtn.classList.toggle('available', historyIndex > 0)
  nextBtn.classList.toggle('available', historyIndex < history.length - 1)
}

// ─────────────────────────────────────────
// Section detection — IntersectionObserver
// ─────────────────────────────────────────

function setupSectionObserver() {
  // Sections to watch — must match HTML id attributes
  const sectionIds = ['top', 'about', 'work', 'contact']

  const sections = sectionIds
    .map(id => document.querySelector('#' + id))
    .filter(Boolean)

  if (sections.length === 0) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Map HTML id to our SECTION_LINES key
          const id = entry.target.id
          const sectionKey = id === 'top' ? 'hero' : id
          currentSection = sectionKey
        }
      })
    },
    {
      // Section is "current" when 50% visible
      threshold: 0.5
    }
  )

  sections.forEach(section => observer.observe(section))
}