import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

export function initAstronaut() {
  return new Promise((resolve) => {
  const container = document.querySelector('#astronaut-canvas')
  if (!container) return

  // ─── Scene, Camera, Renderer ───
  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(
    35,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  )
  camera.position.set(0, 0, 5)

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)

  // ─── Lights ───
  const ambient = new THREE.AmbientLight(0xffffff, 1.6)
  scene.add(ambient)

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2)
  keyLight.position.set(3, 4, 5)
  scene.add(keyLight)

  const rimLight = new THREE.DirectionalLight(0x8b5cf6, 0.6)
  rimLight.position.set(-3, 2, -3)
  scene.add(rimLight)

  // ─── Load the astronaut ───
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')

  const loader = new GLTFLoader()
  loader.setDRACOLoader(dracoLoader)

  let astronaut = null
  let mixer = null

  // Mouse tracking — target is where cursor is, current eases toward it
  const mouseTarget = { x: 0, y: 0 }
  const mouseCurrent = { x: 0, y: 0 }
  let lookOverride = null  // {x, y} in -1..1 range to force gaze at a fixed point

  loader.load(
    '/astronaut_draco.glb',
    (gltf) => {
      astronaut = gltf.scene

      // Center the model
      const box = new THREE.Box3().setFromObject(astronaut)
      const center = box.getCenter(new THREE.Vector3())
      astronaut.position.sub(center)

      // Scale to fit nicely
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 2.5 / maxDim
      astronaut.scale.setScalar(scale)

      scene.add(astronaut)

      // ─── Play the floating animation ───
      mixer = new THREE.AnimationMixer(astronaut)
      // Try idle first (more limb movement), fall back to floating
      const idleClip = gltf.animations.find(clip => clip.name === 'idle')
      const floatingClip = gltf.animations.find(clip => clip.name === 'floating')
      const clip = idleClip || floatingClip
      if (clip) {
        const action = mixer.clipAction(clip)
        action.play()
        console.log(`✅ Astronaut loaded, playing: ${clip.name}`)
      } else {
        console.log('⚠️ No animation clip found')
      }

      resolve()
    },
    (progress) => {
      const percent = (progress.loaded / progress.total) * 100
      console.log(`Loading astronaut: ${percent.toFixed(0)}%`)
    },
    (error) => {
      console.error('❌ Astronaut failed to load:', error)
    }
  )

  // ─── Mouse tracking ───
  window.addEventListener('mousemove', (e) => {
    // Convert screen position to -1..+1 range
    mouseTarget.x = (e.clientX / window.innerWidth - 0.5) * 2
    mouseTarget.y = (e.clientY / window.innerHeight - 0.5) * 2
  })

  // ─── Resize handler ───
  window.addEventListener('resize', () => {
    if (!container) return
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  })

  // ─── Animation loop ───
  const clock = new THREE.Clock()

  function animate() {
    requestAnimationFrame(animate)

    const delta = clock.getDelta()

    // Drive the floating animation
    if (mixer) {
      mixer.update(delta)
    }

    // If lookOverride is set (e.g. hovering a capability star), aim there instead of cursor
    const tx = lookOverride ? lookOverride.x : mouseTarget.x
    const ty = lookOverride ? lookOverride.y : mouseTarget.y
    mouseCurrent.x += (tx - mouseCurrent.x) * 0.05
    mouseCurrent.y += (ty - mouseCurrent.y) * 0.05

    // Astronaut subtly turns toward cursor
    if (astronaut) {
      // Y rotation = looking left/right based on cursor X
      astronaut.rotation.y = mouseCurrent.x * 0.8
      // X rotation = looking up/down based on cursor Y (inverted because screen Y is flipped)
      astronaut.rotation.x = -mouseCurrent.y * 0.4
    }

    renderer.render(scene, camera)
  }

  animate()

  // Expose a method for external code to override gaze direction
  window.__astronautLookAt = (screenX, screenY) => {
    if (screenX === null) {
      lookOverride = null
      return
    }
    lookOverride = {
      x: (screenX / window.innerWidth - 0.5) * 2,
      y: (screenY / window.innerHeight - 0.5) * 2,
    }
  }
  })
}