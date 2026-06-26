/**
 * planets.js — Shared WebGL renderer for the 4 featured planets.
 *
 * ARCHITECTURE
 * ────────────
 * One offscreen WebGLRenderer renders each planet in sequence, then
 * drawImage()s the result into each planet's visible canvas.
 *
 * PUBLIC API
 * ──────────
 *   initPlanets()  →  Promise<void>
 */

import * as THREE from 'three'

// ─── Configuration ────────────────────────────────────────────────────

const PLANET_TEXTURES = {
  purple: '/planets/planet_purple.jpg',
  blue: '/planets/planet_blue.jpg',
  green: '/planets/planet_green.jpg',
  amber: '/planets/planet_amber.jpg',
}

const PLANET_TINTS = {
  purple: new THREE.Color(0xc8a8e8),
  blue: new THREE.Color(0xffffff),
  green: new THREE.Color(0x9fc870),
  amber: new THREE.Color(0xffffff),
}

const ROTATION_PERIODS = {
  purple: 48,
  blue: 56,
  green: 42,
  amber: 61,
}

const AXIAL_TILTS = {
  purple: 8,
  blue: -4,
  green: 11,
  amber: -6,
}

const RIM_COLORS = {
  purple: new THREE.Color(0xb8a8ff),
  blue: new THREE.Color(0x88c4ff),
  green: new THREE.Color(0xa8e070),
  amber: new THREE.Color(0xffc080),
}

const SIZE = 200

// ─── Fresnel rim shader ──────────────────────────────────────────────

const RIM_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const RIM_FRAGMENT = `
  uniform vec3 rimColor;
  uniform float rimIntensity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float fres = 1.0 - dot(vNormal, vViewDir);
    fres = pow(clamp(fres, 0.0, 1.0), 2.5);
    gl_FragColor = vec4(rimColor, fres * rimIntensity);
  }
`

// ─── Public API ──────────────────────────────────────────────────────

export function initPlanets() {
  return new Promise((resolve) => {
    if (!isCapable()) {
        document.querySelectorAll('.planet-img').forEach((img) => {
            if (img.dataset.src) img.src = img.dataset.src
            img.style.display = 'block'
        })
        resolve()
        return
    }

    const wrappers = collectWrappers()
    if (wrappers.length === 0) {
      resolve()
      return
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: false,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(SIZE, SIZE)
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10)
    camera.position.set(0, 0, 4.3)

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0)
    keyLight.position.set(-2, 2.5, 2)
    scene.add(keyLight)

    const hemiLight = new THREE.HemisphereLight(0xffe8c4, 0x2a2440, 1.4)
    scene.add(hemiLight)

    const ambient = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambient)

    const planetGeometry = new THREE.SphereGeometry(1, 64, 64)
    const atmosphereGeometry = new THREE.SphereGeometry(1.06, 64, 64)

    const textureLoader = new THREE.TextureLoader()
    const planets = wrappers.map((w) =>
      buildPlanet(w, planetGeometry, atmosphereGeometry, textureLoader)
    )

    let sectionInView = true
    const section = document.querySelector('.planets-row')
    if (section && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        sectionInView = entries[0].isIntersecting
      }, { rootMargin: '50px' })
      io.observe(section)
    }

    Promise.all(planets.map((p) => p.texturePromise)).then(() => {
      planets.forEach((p) => p.canvas.classList.add('active'))
      resolve()
    })

    const clock = new THREE.Clock()
    let frameCount = 0
    let totalRenderTime = 0
    let benchmarkLogged = false
    const startTime = performance.now()

    function loop() {
      requestAnimationFrame(loop)
      if (!sectionInView) return

      const dt = clock.getDelta()
      const elapsed = (performance.now() - startTime) / 1000
      const tStart = performance.now()

      for (const p of planets) {
        if (!p.inView) continue

        const speedRad = (Math.PI * 2) / ROTATION_PERIODS[p.color]
        p.rotation += dt * speedRad
        p.mesh.rotation.y = p.rotation

        const driftY = Math.sin(elapsed * 0.3 + p.driftPhase) * 0.015
        p.group.position.y = driftY

        scene.add(p.group)
        renderer.render(scene, camera)
        scene.remove(p.group)

        const ctx = p.ctx
        ctx.clearRect(0, 0, p.canvas.width, p.canvas.height)
        ctx.drawImage(renderer.domElement, 0, 0, p.canvas.width, p.canvas.height)
      }

      if (!benchmarkLogged) {
        const ms = performance.now() - tStart
        totalRenderTime += ms
        frameCount += 1
        if (frameCount === 120) {
          const avg = (totalRenderTime / frameCount).toFixed(2)
          console.log(`🪐 Planets avg render: ${avg}ms/frame (budget: 16ms).`)
          benchmarkLogged = true
        }
      }
    }
    requestAnimationFrame(loop)
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────

function isCapable() {
  if (window.innerWidth <= 768) return false
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return false
  const c = document.createElement('canvas')
  const gl = c.getContext('webgl2') || c.getContext('webgl')
  return !!gl
}

function collectWrappers() {
  const features = document.querySelectorAll('.planet-feature')
  const wrappers = []
  features.forEach((feature) => {
    const color = feature.dataset.color
    if (!PLANET_TEXTURES[color]) return
    const orbit = feature.querySelector('.planet-orbit')
    const img = feature.querySelector('.planet-img')
    if (!orbit || !img) return
    const canvas = document.createElement('canvas')
    canvas.className = 'planet-canvas'
    const dpr = Math.min(window.devicePixelRatio, 2)
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    orbit.appendChild(canvas)
    wrappers.push({ feature, orbit, img, canvas, color })
  })
  return wrappers
}

function buildPlanet({ feature, orbit, img, canvas, color }, planetGeo, atmosGeo, textureLoader) {
  const ctx = canvas.getContext('2d')

  const group = new THREE.Group()
  const tiltRad = (AXIAL_TILTS[color] * Math.PI) / 180
  group.rotation.z = tiltRad

  const material = new THREE.MeshStandardMaterial({
    roughness: 1.0,
    metalness: 0.0,
    color: PLANET_TINTS[color],
   })

  const texturePromise = new Promise((resolve) => {
    textureLoader.load(PLANET_TEXTURES[color], (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 4
      material.map = texture
      material.needsUpdate = true
      resolve(texture)
    })
  })

  const mesh = new THREE.Mesh(planetGeo, material)
  group.add(mesh)

  const atmoMaterial = new THREE.ShaderMaterial({
    uniforms: {
      rimColor: { value: RIM_COLORS[color] },
      rimIntensity: { value: 0.0 },
    },
    vertexShader: RIM_VERTEX,
    fragmentShader: RIM_FRAGMENT,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const atmosphere = new THREE.Mesh(atmosGeo, atmoMaterial)
  group.add(atmosphere)

  const state = {
    feature,
    orbit,
    img,
    canvas,
    ctx,
    color,
    group,
    mesh,
    texturePromise,
    rotation: 0,
    driftPhase: Math.random() * Math.PI * 2,
    inView: true,
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      state.inView = entries[0].isIntersecting
    }, { rootMargin: '20px' })
    io.observe(canvas)
  }

  return state
}