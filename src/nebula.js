// Nebula — WebGL fragment shader nebula concentrated behind hero photo
// Fades to nearly invisible at edges. Drift + breathe motion. GPU-accelerated.

import * as THREE from 'three'

export function initNebula() {
  const canvas = document.querySelector('#nebula')
  if (!canvas) return { setParallax: () => {} }

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setSize(window.innerWidth, window.innerHeight)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const uniforms = {
    u_time:       { value: 0 },
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    u_focus:      { value: new THREE.Vector2(0.5, 0.42) },  // hero photo approx position
    u_parallax:   { value: new THREE.Vector2(0, 0) },
  }

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `

  const fragmentShader = `
    precision mediump float;
    varying vec2 vUv;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_focus;
    uniform vec2 u_parallax;

    // Hash + noise utilities for cloud generation
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
        mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
        u.y
      );
    }

    // Fractal Brownian motion = layered noise = cloud-like
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = vUv;
      // Correct for aspect ratio so the radial gradient stays a circle
      float aspect = u_resolution.x / u_resolution.y;
      vec2 p = uv - u_focus - u_parallax;
      p.x *= aspect;

      float dist = length(p);

      // Two slow-drifting noise fields combined for organic motion
      float t = u_time * 0.015;
      vec2 q = uv * 2.5 + u_parallax * 2.0;
      float n1 = fbm(q + vec2(t, t * 0.6));
      float n2 = fbm(q * 1.3 + vec2(-t * 0.8, t * 0.4));
      float cloud = mix(n1, n2, 0.5);

      // Breathing scale — extremely slow
      float breathe = 0.94 + 0.06 * sin(u_time * 0.18);

      // Strong center, falls off rapidly outward
      float radial = exp(-pow(dist * 2.2 / breathe, 1.6));

      // Three color zones — purple, blue, magenta
      vec3 purple  = vec3(0.42, 0.27, 0.78);
      vec3 blue    = vec3(0.20, 0.32, 0.85);
      vec3 magenta = vec3(0.78, 0.27, 0.58);

      // Blend colors based on noise — different clouds in different colors
      vec3 col = mix(purple, blue, smoothstep(0.3, 0.7, n1));
      col = mix(col, magenta, smoothstep(0.55, 0.85, n2) * 0.6);

      // Combine cloud detail with radial mask
      float density = cloud * radial;

      // Cap brightness — atmospheric, never spectacle
      float alpha = density * 0.55;

      gl_FragColor = vec4(col, alpha);
    }
  `

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  })

  const geometry = new THREE.PlaneGeometry(2, 2)
  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  let running = true
  const clock = new THREE.Clock()

  function animate() {
    if (!running) return
    requestAnimationFrame(animate)
    uniforms.u_time.value = clock.getElapsedTime()
    renderer.render(scene, camera)
  }
  animate()

  // Pause when tab hidden
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden
    if (running) {
      clock.start()
      animate()
    }
  })

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
    uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight)
  })

  // External parallax driver
  return {
    setParallax: (x, y) => {
      // x, y are -1..1 normalized mouse coords
      uniforms.u_parallax.value.set(x * 0.02, y * 0.02)
    }
  }
}