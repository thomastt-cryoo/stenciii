import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/** Both views use the completed STL. The 2D view is a top projection, not traced artwork. */
export default function MeshPreview({ url, flat, zoom, fit, theme, onZoom }: { url: string; flat: boolean; zoom: number; fit: number; theme: string; onZoom: (value: number) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<THREE.OrthographicCamera>()
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const el = host.current!
    let renderer: THREE.WebGLRenderer
    setReady(false); setError('')
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) }
    catch { setError('3D rendering is unavailable in this browser. You can still download the completed STL.'); return }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 100000)
    cameraRef.current = camera
    camera.up.set(0, 1, 0)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableRotate = !flat; controls.enableDamping = true; controls.minZoom = .25; controls.maxZoom = 5
    controls.addEventListener('change', () => onZoom(camera.zoom))
    scene.add(new THREE.HemisphereLight(0xffffff, 0x696969, 2))
    const light = new THREE.DirectionalLight(0xffffff, 2.5); light.position.set(-1, 2, 5); scene.add(light)
    renderer.domElement.setAttribute('aria-label', flat ? 'Stencil top view from generated STL' : 'Interactive 3D stencil from generated STL')
    renderer.domElement.setAttribute('role', 'img')
    el.appendChild(renderer.domElement)
    let geometry: THREE.BufferGeometry | undefined, material: THREE.Material | undefined, alive = true
    let radius = 1
    const resize = () => {
      const w = el.clientWidth, h = Math.max(1, el.clientHeight), aspect = w / h
      renderer.setSize(w, h)
      const vertical = radius * 1.3 / Math.min(1, aspect)
      camera.left = -vertical * aspect; camera.right = vertical * aspect
      camera.top = vertical; camera.bottom = -vertical; camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize); observer.observe(el)
    new STLLoader().load(url, g => {
      if (!alive) { g.dispose(); return }
      geometry = g; g.computeBoundingBox(); g.computeVertexNormals()
      const box = g.boundingBox!, size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3())
      g.translate(-center.x, -center.y, -center.z)
      radius = Math.max(size.x, size.y, size.z) / 2
      material = flat ? new THREE.MeshBasicMaterial({ color: theme === 'dark' ? 0xededeb : 0x444441, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ color: 0xd5d5d0, roughness: .85, metalness: 0, side: THREE.DoubleSide })
      scene.add(new THREE.Mesh(g, material))
      if (flat) camera.position.set(0, 0, radius * 4)
      else camera.position.set(radius * 1.1, -radius * 1.5, radius * 2.4)
      controls.target.set(0, 0, 0); controls.update(); resize(); setReady(true)
    }, undefined, () => alive && setError('The model could not be displayed. Try Make Stencil again.'))
    let frame = 0
    const render = () => { frame = requestAnimationFrame(render); controls.update(); renderer.render(scene, camera) }; render()
    return () => { alive = false; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); geometry?.dispose(); material?.dispose(); renderer.dispose(); renderer.domElement.remove(); cameraRef.current = undefined }
  }, [url, flat, fit, theme, onZoom])
  useEffect(() => { if (cameraRef.current) { cameraRef.current.zoom = zoom; cameraRef.current.updateProjectionMatrix() } }, [zoom, ready, fit])
  return <div className="mesh-preview" ref={host} data-ready={ready}>
    {!ready && !error && <span className="view-message">Drawing your stencil…</span>}
    {error && <p className="view-message" role="alert">{error}</p>}
  </div>
}
