import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ArtworkComparison } from './artifacts'

/** One camera and one viewport for both halves; the right half is the actual STL. */
export default function MeshPreview({ url, flat, zoom, fit, theme, onZoom, comparison }: { url: string; flat: boolean; zoom: number; fit: number; theme: string; onZoom: (value: number) => void; comparison?: ArtworkComparison }) {
  const host = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<THREE.OrthographicCamera>()
  const remembered = useRef<{ position: number[]; target: number[]; flat: boolean }>()
  const ratioRef = useRef(.5), [ratio, setRatio] = useState(.5)
  const [error, setError] = useState(''), [ready, setReady] = useState(false)
  const reset = useRef(fit)
  useEffect(() => { ratioRef.current = ratio }, [ratio])
  useEffect(() => {
    const el = host.current!
    let renderer: THREE.WebGLRenderer
    setReady(false); setError('')
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) }
    catch { setError('3D rendering is unavailable in this browser. You can still download the completed STL.'); return }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    const scene = new THREE.Scene(), artwork = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 100000)
    camera.zoom = zoom; cameraRef.current = camera
    camera.up.set(0, 1, 0)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableRotate = !flat; controls.enableDamping = true; controls.minZoom = .25; controls.maxZoom = 5
    controls.addEventListener('change', () => onZoom(camera.zoom))
    scene.add(new THREE.HemisphereLight(0xffffff, 0x696969, 2))
    const light = new THREE.DirectionalLight(0xffffff, 2.5); light.position.set(-1, 2, 5); scene.add(light)
    renderer.domElement.setAttribute('aria-label', comparison ? 'Aligned prepared artwork and generated STL comparison' : flat ? 'Stencil top view from generated STL' : 'Interactive 3D stencil from generated STL')
    renderer.domElement.setAttribute('role', 'img')
    el.appendChild(renderer.domElement)
    const disposables: { dispose(): void }[] = []
    let alive = true, radius = 1
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
      disposables.push(g); g.computeBoundingBox(); g.computeVertexNormals()
      const box = g.boundingBox!, size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3())
      g.translate(-center.x, -center.y, -center.z)
      radius = Math.max(size.x, size.y, size.z) / 2
      const material = flat ? new THREE.MeshBasicMaterial({ color: theme === 'dark' ? 0xededeb : 0x444441, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ color: 0xd5d5d0, roughness: .85, metalness: 0, side: THREE.DoubleSide })
      disposables.push(material); scene.add(new THREE.Mesh(g, material))
      const saved = remembered.current
      if (saved && saved.flat === flat && reset.current === fit) {
        camera.position.fromArray(saved.position); controls.target.fromArray(saved.target)
      } else {
        if (flat) camera.position.set(0, 0, radius * 4)
        else camera.position.set(radius * 1.1, -radius * 1.5, radius * 2.4)
        controls.target.set(0, 0, 0)
      }
      reset.current = fit
      controls.update(); resize()
      if (comparison) {
        const texture = new THREE.TextureLoader().load(comparison.url, () => {
          if (!alive) return
          const border = new THREE.PlaneGeometry(size.x, size.y)
          const white = new THREE.MeshBasicMaterial({ color: 0xffffff })
          artwork.add(new THREE.Mesh(border, white))
          const plane = new THREE.PlaneGeometry(comparison.width, comparison.height)
          const ink = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
          const image = new THREE.Mesh(plane, ink)
          image.position.set(comparison.marginX + comparison.width / 2 - center.x, comparison.marginY + comparison.height / 2 - center.y, .01)
          if (comparison.flip) image.scale.x = -1
          artwork.add(image); disposables.push(border, white, plane, ink)
          setReady(true)
        }, undefined, () => alive && setError('The artwork comparison could not be displayed.'))
        texture.colorSpace = THREE.SRGBColorSpace; disposables.push(texture)
      } else setReady(true)
    }, undefined, () => alive && setError('The model could not be displayed. Try Make Stencil again.'))
    let frame = 0
    const render = () => {
      frame = requestAnimationFrame(render); controls.update()
      renderer.setScissorTest(false); renderer.clear()
      if (comparison) {
        renderer.render(artwork, camera)
        const split = Math.round(el.clientWidth * ratioRef.current)
        renderer.setScissor(split, 0, el.clientWidth - split, el.clientHeight); renderer.setScissorTest(true)
        renderer.render(scene, camera); renderer.setScissorTest(false)
      } else renderer.render(scene, camera)
    }; render()
    return () => {
      remembered.current = { position: camera.position.toArray(), target: controls.target.toArray(), flat }
      alive = false; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); disposables.forEach(d => d.dispose()); renderer.dispose(); renderer.domElement.remove(); cameraRef.current = undefined
    }
  // Keep pan/orbit when a new generation replaces its predecessor. Fit is an explicit reset.
  }, [url, flat, fit, theme, onZoom, comparison])
  useEffect(() => { if (cameraRef.current) { cameraRef.current.zoom = zoom; cameraRef.current.updateProjectionMatrix() } }, [zoom, ready, fit])
  const splitAt = (x: number) => { const box = host.current!.getBoundingClientRect(); setRatio(Math.max(.03, Math.min(.97, (x - box.left) / box.width))) }
  return <div className="mesh-preview" ref={host} data-ready={ready} data-comparison={!!comparison}>
    {!ready && !error && <span className="view-message">Drawing your stencil…</span>}
    {error && <p className="view-message" role="alert">{error}</p>}
    {comparison && <><div className="comparison-labels"><span>Prepared artwork</span><span>STL top view</span></div><button className="comparison-handle" aria-label="Drag comparison divider" style={{ left: `${ratio * 100}%` }} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); splitAt(e.clientX) }} onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) splitAt(e.clientX) }} onPointerUp={e => e.currentTarget.releasePointerCapture(e.pointerId)} tabIndex={-1}><span>↔</span></button><label className="comparison-range">Compare<input type="range" aria-label="Comparison split" min="3" max="97" value={Math.round(ratio * 100)} onChange={e => setRatio(Number(e.target.value) / 100)} /></label></>}
  </div>
}
