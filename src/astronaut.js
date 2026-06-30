import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

// ─── Asset config — only this block changes when swapping the GLB ───────────
const ASSET = {
  path: '/astronaut_draco.glb',
  clips: {
    freeform: 'idle',   // clip during freeform + descent
    landed:   'idle',   // clip when landed (swap to 'seated' when new GLB available)
  },
  headBone:            null,   // set to bone name string if replacement model has one
  breathingAmplitude:  0.012,  // ±1.2% scale pulse — subtle chest rise/fall
  breathingPeriodMs:   4200,   // one breath cycle
  headDriftDeg:        3,      // max head drift in degrees
  headDriftPeriodMs:   9000,   // head drift cycle
  landedTiltX:         0.18,   // radians — slight downward tilt (~10°), contemplative
}

// ─── Journey config — tune landing position here, never in logic ─────────────
const JOURNEY = {
  startSectionId:          'cta',    // descent begins when this section hits viewport centre
  endSectionId:            'footer', // landing completes when footer hits viewport centre
  landingXRatio:           0.58,     // horizontal landing position (fraction of viewport width)
  mountainPeakAboveFooter: 157,      // px above footer top where SVG peak sits — SVG-geometry derived
  landingVerticalOffset:   -40,      // nudge astronaut up/down on peak (negative = up); tune visually
}

// ─── Pure helpers ────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t }
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
function getContainerSize() {
  return window.innerWidth <= 500 ? 110 : window.innerWidth <= 768 ? 130 : 260
}

// ─────────────────────────────────────────────────────────────────────────────

export function initAstronaut() {
  return new Promise((resolve) => {
    const container = document.querySelector('#astronaut-canvas')
    if (!container) return

    // ─── Scene, Camera, Renderer ─────────────────────────────────────────────
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      35,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    )
    camera.position.set(0, 0, 5)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    // ─── Lights ──────────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 1.6)
    scene.add(ambient)
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2)
    keyLight.position.set(3, 4, 5)
    scene.add(keyLight)
    const rimLight = new THREE.DirectionalLight(0x8b5cf6, 0.6)
    rimLight.position.set(-3, 2, -3)
    scene.add(rimLight)

    // ─── Loader ──────────────────────────────────────────────────────────────
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
    const loader = new GLTFLoader()
    loader.setDRACOLoader(dracoLoader)

    let astronaut       = null
    let mixer           = null
    let baseScale       = 1       // set after load — used for breathing scale calculations
    let allClips        = []
    let currentClipName = null
    let currentAction   = null
    let headBone        = null    // resolved at load if ASSET.headBone is set

    // ─── Cursor tracking ─────────────────────────────────────────────────────
    const mouseTarget  = { x: 0, y: 0 }
    const mouseCurrent = { x: 0, y: 0 }
    let lookOverride   = null

    // ─── Journey state ───────────────────────────────────────────────────────
    let journeyState    = 'freeform'  // 'freeform' | 'descending' | 'landed'
    let journeyT        = 0
    let startPos        = null        // { left, top } captured when descent begins
    let landedStartTime = null        // timestamp when landed state first entered

    // ─── Load model ──────────────────────────────────────────────────────────
    loader.load(
      ASSET.path,
      (gltf) => {
        astronaut = gltf.scene
        allClips  = gltf.animations

        // Center
        const box    = new THREE.Box3().setFromObject(astronaut)
        const center = box.getCenter(new THREE.Vector3())
        astronaut.position.sub(center)

        // Scale — store baseScale for breathing math
        const size   = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        baseScale    = 2.5 / maxDim
        astronaut.scale.setScalar(baseScale)

        // Resolve head bone if asset names one
        if (ASSET.headBone) {
          astronaut.traverse(obj => {
            if (obj.isBone && obj.name === ASSET.headBone) headBone = obj
          })
        }

        scene.add(astronaut)

        // Start initial clip
        mixer = new THREE.AnimationMixer(astronaut)
        playClip(ASSET.clips.freeform)

        resolve()
      },
      (progress) => {
        const pct = progress.total ? ((progress.loaded / progress.total) * 100).toFixed(0) : '?'
        console.log(`Loading astronaut: ${pct}%`)
      },
      (error) => console.error('❌ Astronaut failed to load:', error)
    )

    // ─── Clip switcher — asset-agnostic ──────────────────────────────────────
    function playClip(name) {
      if (!mixer || !allClips.length) return
      if (currentClipName === name) return
      const clip = allClips.find(c => c.name === name) || allClips[0]
      if (!clip) return
      const next = mixer.clipAction(clip)
      if (currentAction && currentAction !== next) {
        next.reset().fadeIn(0.6)
        currentAction.fadeOut(0.6)
      } else {
        next.reset().play()
      }
      currentAction   = next
      currentClipName = name
      console.log(`✅ Clip: ${clip.name}`)
    }

    // ─── Journey: scroll progress 0→1 across descent range ───────────────────
    function getJourneyT() {
      const startEl = document.getElementById(JOURNEY.startSectionId)
      const endEl   = document.getElementById(JOURNEY.endSectionId)
      if (!startEl || !endEl) return 0
      const scrollStart = startEl.offsetTop
      const scrollEnd   = endEl.offsetTop
      const refY        = window.scrollY + window.innerHeight * 0.5
      return Math.min(1, Math.max(0, (refY - scrollStart) / (scrollEnd - scrollStart || 1)))
    }

    // ─── Journey: landing coordinates in viewport space ───────────────────────
    function getLandingPos() {
      const endEl = document.getElementById(JOURNEY.endSectionId)
      if (!endEl) return null
      const footerTop = endEl.getBoundingClientRect().top
      const size      = getContainerSize()
      const peakY     = footerTop - JOURNEY.mountainPeakAboveFooter
      return {
        left: window.innerWidth * JOURNEY.landingXRatio - size / 2,
        top:  peakY - size * 0.5 + JOURNEY.landingVerticalOffset,
      }
    }

    // ─── Journey: apply interpolated container position ───────────────────────
    function applyJourneyPosition(t) {
      // Capture starting position once on first frame of descent
      if (!startPos) {
        const rect = container.getBoundingClientRect()
        startPos = { left: rect.left, top: rect.top }
      }
      const landing = getLandingPos()
      if (!landing) return
      const ease = easeInOutCubic(Math.min(1, Math.max(0, t)))
      container.style.left = lerp(startPos.left, landing.left, ease) + 'px'
      container.style.top  = lerp(startPos.top,  landing.top,  ease) + 'px'
    }

    // ─── Landed: micro-life loop — "mission complete, not animation stopped" ──
    function tickLandedIdle(nowMs) {
      if (!astronaut) return
      if (landedStartTime === null) landedStartTime = nowMs
      const elapsed = nowMs - landedStartTime

      // Breathing: slow scale pulse
      const breathPhase = (elapsed % ASSET.breathingPeriodMs) / ASSET.breathingPeriodMs
      const breathScale = 1 + Math.sin(breathPhase * Math.PI * 2) * ASSET.breathingAmplitude
      astronaut.scale.setScalar(baseScale * breathScale)

      // Head drift — only if bone resolved at load
      if (headBone) {
        const headPhase = (elapsed % ASSET.headDriftPeriodMs) / ASSET.headDriftPeriodMs
        headBone.rotation.y = Math.sin(headPhase * Math.PI * 2) * (ASSET.headDriftDeg * Math.PI / 180)
      }
    }

    // ─── Scroll handler → update journey state ────────────────────────────────
    function onScroll() {
      const t    = getJourneyT()
      journeyT   = t
      const prev = journeyState

      if (t <= 0)      journeyState = 'freeform'
      else if (t >= 1) journeyState = 'landed'
      else             journeyState = 'descending'

      // Returning to freeform: clear all journey overrides, restore CSS control
      if (journeyState === 'freeform' && prev !== 'freeform') {
        startPos             = null
        landedStartTime      = null
        container.style.left = ''
        container.style.top  = ''
        if (astronaut) astronaut.scale.setScalar(baseScale)
      }

      // Clip transitions
      if (journeyState === 'landed') {
        playClip(ASSET.clips.landed)
      } else {
        playClip(ASSET.clips.freeform)
      }
    }

    // ─── Mouse tracking — only active in freeform ─────────────────────────────
    window.addEventListener('mousemove', (e) => {
      if (journeyState !== 'freeform') return
      mouseTarget.x = (e.clientX / window.innerWidth  - 0.5) * 2
      mouseTarget.y = (e.clientY / window.innerHeight - 0.5) * 2
    })

    // ─── Listeners ───────────────────────────────────────────────────────────
    window.addEventListener('scroll', onScroll, { passive: true })

    window.addEventListener('resize', () => {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
      // Recapture start position on resize so proportions stay correct
      if (journeyState !== 'freeform') startPos = null
    })

    // ─── Animation loop ───────────────────────────────────────────────────────
    const clock = new THREE.Clock()

    function animate(nowMs) {
      requestAnimationFrame(animate)
      const delta = clock.getDelta()
      if (mixer) mixer.update(delta)
      if (!astronaut) return

      if (journeyState === 'freeform') {
        // Cursor follow — only active here
        const tx = lookOverride ? lookOverride.x : mouseTarget.x
        const ty = lookOverride ? lookOverride.y : mouseTarget.y
        mouseCurrent.x += (tx - mouseCurrent.x) * 0.05
        mouseCurrent.y += (ty - mouseCurrent.y) * 0.05
        astronaut.rotation.y =  mouseCurrent.x * 0.8
        astronaut.rotation.x = -mouseCurrent.y * 0.4

      } else if (journeyState === 'descending') {
        applyJourneyPosition(journeyT)
        // Tilt toward horizon proportionally to descent progress
        astronaut.rotation.x = ASSET.landedTiltX * easeInOutCubic(journeyT)
        // Smoothly centre the Y gaze as he descends
        astronaut.rotation.y = lerp(astronaut.rotation.y, 0, 0.05)

      } else {
        // Landed — hold position, hold tilt, add micro-life
        applyJourneyPosition(1)
        astronaut.rotation.x = ASSET.landedTiltX
        astronaut.rotation.y = lerp(astronaut.rotation.y, 0, 0.05)
        tickLandedIdle(nowMs)
      }

      renderer.render(scene, camera)
    }

    requestAnimationFrame(animate)

    // ─── Gaze API — silently ignored outside freeform ─────────────────────────
    window.__astronautLookAt = (screenX, screenY) => {
      if (journeyState !== 'freeform') return
      if (screenX === null) { lookOverride = null; return }
      lookOverride = {
        x: (screenX / window.innerWidth  - 0.5) * 2,
        y: (screenY / window.innerHeight - 0.5) * 2,
      }
    }
  })
}