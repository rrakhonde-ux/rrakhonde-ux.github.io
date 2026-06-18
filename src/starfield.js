import * as THREE from 'three'

export function initStarfield() {
  const canvas = document.querySelector('#starfield')
  if (!canvas) return
// ─── Create soft circular star texture ───
  function createStarTexture() {
    const size = 64
    const canvas2d = document.createElement('canvas')
    canvas2d.width = size
    canvas2d.height = size
    const ctx = canvas2d.getContext('2d')

    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    )
    gradient.addColorStop(0,    'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.2,  'rgba(255, 255, 255, 0.8)')
    gradient.addColorStop(0.5,  'rgba(255, 255, 255, 0.3)')
    gradient.addColorStop(1,    'rgba(255, 255, 255, 0)')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    const texture = new THREE.CanvasTexture(canvas2d)
    texture.needsUpdate = true
    return texture
  }

  const starTexture = createStarTexture()
  // ─── Scene, Camera, Renderer ───
  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  )
  camera.position.z = 500

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)

  // ─── Generate Stars ───
  const STAR_COUNT = 2500
  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  const sizes = new Float32Array(STAR_COUNT)

  for (let i = 0; i < STAR_COUNT; i++) {
    // Random positions in a large 3D box
    positions[i * 3]     = (Math.random() - 0.5) * 2000   // x
    positions[i * 3 + 1] = (Math.random() - 0.5) * 2000   // y
    positions[i * 3 + 2] = (Math.random() - 0.5) * 1500   // z

    // Subtle color variation — mostly white, hints of blue/purple
    const colorPick = Math.random()
    if (colorPick < 0.7) {
      colors[i * 3] = 1.0; colors[i * 3 + 1] = 1.0; colors[i * 3 + 2] = 1.0   // white
    } else if (colorPick < 0.9) {
      colors[i * 3] = 0.7; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 1.0   // cool blue
    } else {
      colors[i * 3] = 0.9; colors[i * 3 + 1] = 0.7; colors[i * 3 + 2] = 1.0   // soft purple
    }

    // Random sizes for variety
    sizes[i] = Math.random() * 2 + 0.5
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  const material = new THREE.PointsMaterial({
    size: 4,
    map: starTexture,
    alphaTest: 0.01,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  const stars = new THREE.Points(geometry, material)
  scene.add(stars)

  // ─── Mouse parallax ───
  const mouse = { x: 0, y: 0 }
  const target = { x: 0, y: 0 }

  window.addEventListener('mousemove', (e) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 2
    target.y = (e.clientY / window.innerHeight - 0.5) * 2
  })

  // ─── Resize handler ───
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  // ─── Animation loop ───
  let animationId
  const clock = new THREE.Clock()

  function animate() {
    animationId = requestAnimationFrame(animate)

    const elapsed = clock.getElapsedTime()

    // Smoothly ease toward mouse target (parallax)
    mouse.x += (target.x - mouse.x) * 0.03
    mouse.y += (target.y - mouse.y) * 0.03

    // Gentle continuous drift
    stars.rotation.y = elapsed * 0.02 + mouse.x * 0.2
    stars.rotation.x = mouse.y * 0.15

    renderer.render(scene, camera)
  }

  animate()

  // ─── Pause when tab is hidden (saves battery) ───
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationId)
    } else {
      animate()
    }
  })
}