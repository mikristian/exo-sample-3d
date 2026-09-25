import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { boundaryIndicesForEdge, createGeometry, getAvatarArmPose, getAvatarHeightScale, getAvatarTorsoRadii, getAvatarUpperBodyDimensions, refreshSimulationAnalysis, syncAnalysisColors, syncGeometry } from '../core/physics.js'
import { createSimulationSession } from '../core/backends/registry.js'
import { solveWithNativeService } from '../core/backends/nativeServiceClient.js'

function syncSurfaceOverlay(record) {
  const position = record.meshRecord.geometry.getAttribute('position')
  const normal = record.meshRecord.geometry.getAttribute('normal')
  if (!position || !normal) return

  if (record.type === 'graphic') {
    const attribute = record.object.geometry.getAttribute('position')
    for (let index = 0; index < record.mappings.length; index += 1) {
      const mapping = record.mappings[index]
      if (!mapping) {
        attribute.setXYZ(index, 0, 0, 0)
        continue
      }
      const [aIndex, bIndex, cIndex] = mapping.indices
      const [wa, wb, wc] = mapping.weights
      const x = position.getX(aIndex) * wa + position.getX(bIndex) * wb + position.getX(cIndex) * wc
      const y = position.getY(aIndex) * wa + position.getY(bIndex) * wb + position.getY(cIndex) * wc
      const z = position.getZ(aIndex) * wa + position.getZ(bIndex) * wb + position.getZ(cIndex) * wc
      let nx = normal.getX(aIndex) * wa + normal.getX(bIndex) * wb + normal.getX(cIndex) * wc
      let ny = normal.getY(aIndex) * wa + normal.getY(bIndex) * wb + normal.getY(cIndex) * wc
      let nz = normal.getZ(aIndex) * wa + normal.getZ(bIndex) * wb + normal.getZ(cIndex) * wc
      const normalLength = Math.hypot(nx, ny, nz) || 1
      nx /= normalLength
      ny /= normalLength
      nz /= normalLength
      attribute.setXYZ(index, x + nx * record.lift, y + ny * record.lift, z + nz * record.lift)
    }
    attribute.needsUpdate = true
    record.object.geometry.computeBoundingSphere()
    return
  }

  if (record.type === 'line') {
    const attribute = record.object.geometry.getAttribute('position')
    for (let index = 0; index < record.indices.length; index += 1) {
      const vertexIndex = record.indices[index]
      attribute.setXYZ(
        index,
        position.getX(vertexIndex) + normal.getX(vertexIndex) * record.lift,
        position.getY(vertexIndex) + normal.getY(vertexIndex) * record.lift,
        position.getZ(vertexIndex) + normal.getZ(vertexIndex) * record.lift,
      )
    }
    attribute.needsUpdate = true
    if (record.object.isLine && record.object.material?.isLineDashedMaterial) record.object.computeLineDistances()
    return
  }

  if (record.type === 'button') {
    const vertexIndex = record.vertexIndex
    record.object.position.set(
      position.getX(vertexIndex) + normal.getX(vertexIndex) * record.lift,
      position.getY(vertexIndex) + normal.getY(vertexIndex) * record.lift,
      position.getZ(vertexIndex) + normal.getZ(vertexIndex) * record.lift,
    )
    return
  }

  if (record.type === 'surface-object') {
    const vertexIndex = record.vertexIndex
    const nx = normal.getX(vertexIndex)
    const ny = normal.getY(vertexIndex)
    const nz = normal.getZ(vertexIndex)
    record.object.position.set(
      position.getX(vertexIndex) + nx * record.lift,
      position.getY(vertexIndex) + ny * record.lift,
      position.getZ(vertexIndex) + nz * record.lift,
    )
    const surfaceNormal = new THREE.Vector3(nx, ny, nz).normalize()
    const base = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), surfaceNormal)
    const twist = new THREE.Quaternion().setFromAxisAngle(surfaceNormal, THREE.MathUtils.degToRad(Number(record.orientationDeg || 0)))
    record.object.quaternion.copy(twist.multiply(base))
  }
}

function makeTrimLine(meshRecord, indices, material, lift = 0.0025) {
  if (!indices?.length || indices.length < 2) return null
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(indices.length * 3), 3))
  const object = new THREE.Line(geometry, material)
  object.renderOrder = 31
  const record = { type: 'line', object, meshRecord, indices, lift }
  syncSurfaceOverlay(record)
  return record
}

function nearestFlatVertexIndex(simPiece, point) {
  let bestIndex = 0
  let bestDistance = Infinity
  for (let index = 0; index < simPiece.flatVertices.length; index += 1) {
    const candidate = simPiece.flatVertices[index]
    const distance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
}

function triangleMapping(point, a, b, c) {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
  if (Math.abs(denominator) < 1e-8) return null
  const wa = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denominator
  const wb = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denominator
  const wc = 1 - wa - wb
  if (wa < -1e-4 || wb < -1e-4 || wc < -1e-4) return null
  return [wa, wb, wc]
}

function mapFlatPointToMesh(simPiece, point) {
  for (const face of simPiece.faces) {
    const [aIndex, bIndex, cIndex] = face
    const weights = triangleMapping(
      point,
      simPiece.flatVertices[aIndex],
      simPiece.flatVertices[bIndex],
      simPiece.flatVertices[cIndex],
    )
    if (weights) return { indices: [aIndex, bIndex, cIndex], weights }
  }
  return null
}

function makeGraphicOverlay(meshRecord, graphic, segments = 12) {
  if (!graphic?.src) return null
  const count = segments + 1
  const mappings = []
  const uvs = new Float32Array(count * count * 2)
  const positions = new Float32Array(count * count * 3)
  const indices = []
  const rotation = THREE.MathUtils.degToRad(Number(graphic.rotationDeg || 0))
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  const width = Math.max(0.1, Number(graphic.widthCm ?? 20))
  const height = Math.max(0.1, Number(graphic.heightCm ?? 20))
  const centerX = Number(graphic.x ?? 0)
  const centerY = Number(graphic.y ?? 0)

  for (let row = 0; row < count; row += 1) {
    const v = row / segments
    for (let column = 0; column < count; column += 1) {
      const u = column / segments
      const localX = (u - 0.5) * width
      const localY = (0.5 - v) * height
      const point = {
        x: centerX + localX * cosine - localY * sine,
        y: centerY + localX * sine + localY * cosine,
      }
      mappings.push(mapFlatPointToMesh(meshRecord.simPiece, point))
      const uvIndex = (row * count + column) * 2
      uvs[uvIndex] = u
      uvs[uvIndex + 1] = 1 - v
    }
  }

  for (let row = 0; row < segments; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      const a = row * count + column
      const b = a + 1
      const c = a + count
      const d = c + 1
      if (mappings[a] && mappings[b] && mappings[c]) indices.push(a, c, b)
      if (mappings[b] && mappings[c] && mappings[d]) indices.push(b, c, d)
    }
  }
  if (!indices.length) return null

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  const texture = new THREE.TextureLoader().load(graphic.src)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: Math.max(0, Math.min(1, Number(graphic.opacity ?? 1))),
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  })
  const object = new THREE.Mesh(geometry, material)
  object.renderOrder = 29
  const record = { type: 'graphic', object, meshRecord, mappings, lift: 0.0032 }
  syncSurfaceOverlay(record)
  return record
}

function makeAvatarTorsoGeometry(avatar) {
  const verticalSegments = 20
  const radialSegments = 40
  const heightScale = getAvatarHeightScale(avatar)
  const minY = 0.58 * heightScale
  const maxY = 1.49 * heightScale
  const positions = []
  const indices = []

  for (let row = 0; row <= verticalSegments; row += 1) {
    const t = row / verticalSegments
    const y = THREE.MathUtils.lerp(minY, maxY, t)
    const radii = getAvatarTorsoRadii(avatar, y)
    for (let column = 0; column < radialSegments; column += 1) {
      const angle = (column / radialSegments) * Math.PI * 2
      positions.push(Math.cos(angle) * radii.x, y, Math.sin(angle) * radii.z)
    }
  }

  for (let row = 0; row < verticalSegments; row += 1) {
    for (let column = 0; column < radialSegments; column += 1) {
      const nextColumn = (column + 1) % radialSegments
      const a = row * radialSegments + column
      const b = row * radialSegments + nextColumn
      const c = (row + 1) * radialSegments + column
      const d = (row + 1) * radialSegments + nextColumn
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function makeFabricTexture(fabric, sourceField = 'src', colorTexture = false) {
  const source = fabric?.texture?.[sourceField]
  if (!source) return null
  const texture = new THREE.TextureLoader().load(source)
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.center.set(0.5, 0.5)
  texture.rotation = THREE.MathUtils.degToRad(Number(fabric.texture.rotationDeg || 0))
  texture.needsUpdate = true
  return texture
}

function makeAvatar(project) {
  const group = new THREE.Group()
  group.name = 'avatar'
  const opacity = project.avatar?.visibility ?? 0.82
  const material = new THREE.MeshStandardMaterial({
    color: 0x6b6b6b,
    roughness: 0.7,
    metalness: 0,
    transparent: opacity < 0.99,
    opacity,
    // A semi-transparent fitting avatar should not occlude cloth in the depth
    // buffer. Otherwise nearly invisible body geometry can make intact garment
    // faces look as though they are missing or torn.
    depthWrite: opacity >= 0.99,
  })
  const hipScale = Math.max(0.82, Math.min(1.24, (project.avatar?.hipCm || 94) / 94))
  const upper = getAvatarUpperBodyDimensions(project.avatar)
  const heightScale = upper.heightScale

  const addEllipsoid = (position, scale) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 24), material)
    mesh.position.set(...position)
    mesh.scale.set(...scale)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  const torso = new THREE.Mesh(makeAvatarTorsoGeometry(project.avatar), material)
  torso.castShadow = true
  torso.receiveShadow = true
  group.add(torso)
  addEllipsoid([0, upper.shoulderCenterY, 0], [upper.shoulderCapRadiusX, upper.shoulderCapRadiusY, upper.shoulderCapRadiusZ])
  addEllipsoid([0, upper.neckCenterY, 0], [upper.neckRadius, upper.neckRadiusY, upper.neckRadius])
  addEllipsoid([0, 0.78 * heightScale, 0], [0.20 * hipScale, 0.28 * heightScale, 0.14 * hipScale])
  addEllipsoid([0, 1.88 * heightScale, 0], [0.14, 0.18 * heightScale, 0.14])
  addEllipsoid([-0.105, 0.24 * heightScale, 0], [0.09, 0.48 * heightScale, 0.10])
  addEllipsoid([0.105, 0.24 * heightScale, 0], [0.09, 0.48 * heightScale, 0.10])

  const leftPose = getAvatarArmPose(project.avatar, -1)
  const armGeometry = new THREE.CapsuleGeometry(leftPose.radius, leftPose.halfLength * 2, 6, 16)
  const leftArm = new THREE.Mesh(armGeometry, material)
  leftArm.position.copy(leftPose.center)
  leftArm.rotation.z = leftPose.rotationZ
  leftArm.castShadow = true
  group.add(leftArm)
  const rightArm = leftArm.clone()
  const rightPose = getAvatarArmPose(project.avatar, 1)
  rightArm.position.copy(rightPose.center)
  rightArm.rotation.z = rightPose.rotationZ
  group.add(rightArm)

  return group
}

export default function GarmentViewport({ project, running, resetSignal, wireframe, analysisMode = 'surface', backendId = 'browser-pbd', nativeSolveSignal = 0, nativeClothModel = 'distance', nativeBendingModel = 'distance', exportSignal = 0, glbExportSignal = 0, renderSignal = 0, hdriUrl = '', onExportMesh, onExportGlb, onRenderStill, onStats, onNativeSolve }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const simulationRef = useRef(null)
  const backendRef = useRef(null)
  const backendSessionRef = useRef(null)
  const meshRecordsRef = useRef([])
  const trimRecordsRef = useRef([])
  const avatarRef = useRef(null)
  const windHelperRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const environmentRef = useRef(null)
  const studioEnvironmentRef = useRef(null)
  const customEnvironmentRef = useRef(null)
  const hemiLightRef = useRef(null)
  const keyLightRef = useRef(null)
  const rimLightRef = useRef(null)
  const projectRef = useRef(project)
  const runningRef = useRef(running)
  const wireframeRef = useRef(wireframe)
  const analysisModeRef = useRef(analysisMode)
  const onStatsRef = useRef(onStats)
  const onNativeSolveRef = useRef(onNativeSolve)
  const onExportMeshRef = useRef(onExportMesh)
  const onExportGlbRef = useRef(onExportGlb)
  const onRenderStillRef = useRef(onRenderStill)

  projectRef.current = project
  runningRef.current = running
  wireframeRef.current = wireframe
  analysisModeRef.current = analysisMode
  onStatsRef.current = onStats
  onNativeSolveRef.current = onNativeSolve
  onExportMeshRef.current = onExportMesh
  onExportGlbRef.current = onExportGlb
  onRenderStillRef.current = onRenderStill

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x101010)
    scene.fog = new THREE.Fog(0x101010, 4.2, 8.5)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(34, 1, 0.02, 30)
    const initialHeightScale = getAvatarHeightScale(projectRef.current.avatar)
    camera.position.set(2.35 * initialHeightScale, 1.55 * initialHeightScale, 3.65 * initialHeightScale)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
    rendererRef.current = renderer
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    mount.appendChild(renderer.domElement)

    const roomEnvironment = new RoomEnvironment()
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    environmentRef.current = pmremGenerator.fromScene(roomEnvironment, 0.04).texture
    studioEnvironmentRef.current = environmentRef.current
    scene.environment = environmentRef.current
    roomEnvironment.dispose()

    const controls = new OrbitControls(camera, renderer.domElement)
    controlsRef.current = controls
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.target.set(0, 1.05 * initialHeightScale, 0)
    controls.minDistance = 1.7 * initialHeightScale
    controls.maxDistance = 7 * initialHeightScale

    const hemi = new THREE.HemisphereLight(0xf4f5ff, 0x242424, 2.0)
    hemiLightRef.current = hemi
    scene.add(hemi)
    const key = new THREE.DirectionalLight(0xffffff, 3.1)
    keyLightRef.current = key
    key.position.set(2.5, 4.5, 3.1)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x9aa7ff, 1.2)
    rimLightRef.current = rim
    rim.position.set(-3, 2, -2.5)
    scene.add(rim)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 96),
      new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.92, metalness: 0 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.005
    floor.receiveShadow = true
    scene.add(floor)
    const grid = new THREE.GridHelper(5.5, 22, 0x353535, 0x222222)
    grid.position.y = 0.002
    scene.add(grid)

    const resize = () => {
      const width = Math.max(1, mount.clientWidth)
      const height = Math.max(1, mount.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    resize()

    let animationFrame = 0
    let lastTime = performance.now()
    let statsClock = 0
    const tick = (time) => {
      const dt = Math.min((time - lastTime) / 1000, 1 / 20)
      lastTime = time
      const simulation = simulationRef.current
      if (simulation && runningRef.current) {
        const backend = backendRef.current
        const backendSession = backendSessionRef.current
        if (backend?.stepAsync) {
          backend.stepAsync(backendSession, 8).catch(() => {})
        } else {
          backend?.step?.(backendSession, dt)
        }
        for (const record of meshRecordsRef.current) {
          syncGeometry(record.simPiece, record.geometry, projectRef.current)
          syncAnalysisColors(record.simPiece, record.geometry, analysisModeRef.current)
        }
        for (const record of trimRecordsRef.current) syncSurfaceOverlay(record)
      }
      controls.update()
      renderer.render(scene, camera)
      statsClock += dt
      if (statsClock > 0.5 && simulation) {
        statsClock = 0
        const vertexCount = [...simulation.pieces.values()].reduce((sum, piece) => sum + piece.particles.length, 0)
        const backendStats = backendRef.current?.getStats?.(backendSessionRef.current) || {}
        onStatsRef.current?.({
          vertices: vertexCount,
          constraints: simulation.constraints.length,
          seams: simulation.seamConstraints.length,
          fasteners: simulation.fastenerConstraints?.length || 0,
          treatments: simulation.treatmentConstraints?.length || 0,
          trims: simulation.trimConstraints?.length || 0,
          anchors: simulation.anchorConstraints?.length || 0,
          manualPins: simulation.manualPinConstraints?.length || 0,
          internal: simulation.internalConstraints?.length || 0,
          elapsed: simulation.elapsed,
          averageStrain: simulation.strain?.average || 0,
          maxStrain: simulation.strain?.max || 0,
          averageEaseCm: simulation.fit?.averageEaseCm || 0,
          averagePressureIndex: simulation.fit?.averagePressureIndex || 0,
          maxPressureIndex: simulation.fit?.maxPressureIndex || 0,
          contactRatio: simulation.fit?.contactRatio || 0,
          tightRatio: simulation.fit?.tightRatio || 0,
          looseRatio: simulation.fit?.looseRatio || 0,
          backendId: backendRef.current?.id || 'browser-pbd',
          backendFrame: backendStats.frame || 0,
          backendElapsedMs: backendStats.elapsedMs || 0,
          backendError: backendStats.serviceError || null,
        })
      }
      animationFrame = requestAnimationFrame(tick)
    }
    animationFrame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationFrame)
      observer.disconnect()
      controls.dispose()
      customEnvironmentRef.current?.dispose?.()
      studioEnvironmentRef.current?.dispose?.()
      customEnvironmentRef.current = null
      studioEnvironmentRef.current = null
      environmentRef.current = null
      pmremGenerator.dispose()
      renderer.dispose()
      rendererRef.current = null
      renderer.domElement.remove()
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose?.()
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose?.())
        }
      })
      sceneRef.current = null
      cameraRef.current = null
      controlsRef.current = null
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    const renderer = rendererRef.current
    if (!scene || !renderer) return
    const settings = project.render || {}
    renderer.toneMappingExposure = Math.max(0.2, Math.min(4, Number(settings.exposure ?? 1.1)))
    const preset = settings.environmentPreset || 'studio'
    const lighting = {
      studio: { hemi: 2.0, key: 3.1, rim: 1.2, background: 0x101010 },
      softbox: { hemi: 2.55, key: 2.3, rim: 0.65, background: 0x181818 },
      dramatic: { hemi: 0.75, key: 4.35, rim: 2.35, background: 0x060606 },
      neutral: { hemi: 1.55, key: 2.45, rim: 0.8, background: 0x222222 },
    }[preset] || { hemi: 2.0, key: 3.1, rim: 1.2, background: 0x101010 }
    if (hemiLightRef.current) hemiLightRef.current.intensity = lighting.hemi
    if (keyLightRef.current) keyLightRef.current.intensity = lighting.key
    if (rimLightRef.current) rimLightRef.current.intensity = lighting.rim
    const environment = customEnvironmentRef.current || studioEnvironmentRef.current
    scene.environment = environment || null
    if (settings.showEnvironment && environment) {
      scene.background = environment
      scene.fog = null
    } else {
      scene.background = new THREE.Color(lighting.background)
      scene.fog = new THREE.Fog(lighting.background, 4.2, 8.5)
    }
  }, [project.render, hdriUrl])

  useEffect(() => {
    const scene = sceneRef.current
    const renderer = rendererRef.current
    if (!scene || !renderer) return undefined
    if (!hdriUrl) {
      customEnvironmentRef.current?.dispose?.()
      customEnvironmentRef.current = null
      environmentRef.current = studioEnvironmentRef.current
      scene.environment = studioEnvironmentRef.current
      if (projectRef.current.render?.showEnvironment) scene.background = studioEnvironmentRef.current
      return undefined
    }
    let cancelled = false
    let sourceTexture = null
    void (async () => {
      try {
        const { RGBELoader } = await import('three/examples/jsm/loaders/RGBELoader.js')
        sourceTexture = await new RGBELoader().loadAsync(hdriUrl)
        if (cancelled) {
          sourceTexture.dispose()
          return
        }
        const pmrem = new THREE.PMREMGenerator(renderer)
        const nextEnvironment = pmrem.fromEquirectangular(sourceTexture).texture
        pmrem.dispose()
        sourceTexture.dispose()
        sourceTexture = null
        customEnvironmentRef.current?.dispose?.()
        customEnvironmentRef.current = nextEnvironment
        environmentRef.current = nextEnvironment
        scene.environment = nextEnvironment
        if (projectRef.current.render?.showEnvironment) scene.background = nextEnvironment
      } catch (error) {
        console.error('HDRI environment failed to load', error)
      }
    })()
    return () => {
      cancelled = true
      sourceTexture?.dispose?.()
    }
  }, [hdriUrl])

  useEffect(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    const heightScale = getAvatarHeightScale(project.avatar)
    camera.position.set(2.35 * heightScale, 1.55 * heightScale, 3.65 * heightScale)
    controls.target.set(0, 1.05 * heightScale, 0)
    controls.minDistance = 1.7 * heightScale
    controls.maxDistance = 7 * heightScale
    controls.update()
  }, [project.avatar?.heightCm])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return undefined

    for (const record of meshRecordsRef.current) {
      scene.remove(record.mesh)
      record.geometry.dispose()
      record.fabricMap?.dispose?.()
      record.normalMap?.dispose?.()
      record.roughnessMap?.dispose?.()
      record.material.dispose()
    }
    meshRecordsRef.current = []

    for (const record of trimRecordsRef.current) {
      scene.remove(record.object)
      record.object.geometry?.dispose?.()
      record.object.material?.map?.dispose?.()
      record.object.material?.dispose?.()
    }
    trimRecordsRef.current = []

    if (avatarRef.current) {
      scene.remove(avatarRef.current)
      avatarRef.current.traverse((object) => {
        object.geometry?.dispose?.()
        if (object.material && object.material !== avatarRef.current?.material) object.material.dispose?.()
      })
    }
    avatarRef.current = makeAvatar(project)
    scene.add(avatarRef.current)

    if (windHelperRef.current) {
      scene.remove(windHelperRef.current)
      windHelperRef.current.traverse?.((object) => {
        object.geometry?.dispose?.()
        object.material?.dispose?.()
      })
      windHelperRef.current = null
    }
    if (project.simulation?.wind?.enabled) {
      const radians = THREE.MathUtils.degToRad(Number(project.simulation.wind.directionDeg ?? 0))
      const direction = new THREE.Vector3(Math.sin(radians), 0, Math.cos(radians)).normalize()
      const speed = Math.max(0, Number(project.simulation.wind.speed ?? 0))
      const length = Math.max(0.28, Math.min(0.78, 0.28 + speed * 0.035))
      const helper = new THREE.ArrowHelper(direction, new THREE.Vector3(-0.72, 0.22, 0.48), length, 0x8ea7ff, 0.10, 0.055)
      helper.name = 'wind-direction-gizmo'
      scene.add(helper)
      windHelperRef.current = helper
    }

    backendRef.current?.dispose?.(backendSessionRef.current)
    const { backend, session } = createSimulationSession(project, backendId)
    const simulation = session.simulation
    if (!simulation?.pieces) throw new Error(`Simulation backend ${backendId} does not expose an in-process mesh session`)
    backendRef.current = backend
    backendSessionRef.current = session
    simulationRef.current = simulation
    for (const simPiece of simulation.pieces.values()) {
      const geometry = createGeometry(simPiece)
      syncGeometry(simPiece, geometry, project)
      const fabric = project.fabrics?.[simPiece.piece.fabricId] || project.fabrics?.main || {}
      const fabricColor = new THREE.Color(fabric.color || '#d3d3d3')
      const analysisEnabled = analysisModeRef.current !== 'surface'
      const isInterfacing = simPiece.piece.generatedRole === 'interfacing'
      const fabricMap = makeFabricTexture(fabric, 'src', true)
      const normalMap = makeFabricTexture(fabric, 'normalSrc', false)
      const roughnessMap = makeFabricTexture(fabric, 'roughnessSrc', false)
      const normalStrength = Math.max(0, Math.min(4, Number(fabric.normalStrength ?? 1)))
      const material = new THREE.MeshPhysicalMaterial({
        color: analysisEnabled ? 0xffffff : fabricColor,
        map: analysisEnabled ? null : fabricMap,
        normalMap: analysisEnabled ? null : normalMap,
        normalScale: new THREE.Vector2(normalStrength, normalStrength),
        roughnessMap: analysisEnabled ? null : roughnessMap,
        side: THREE.DoubleSide,
        roughness: Math.max(0.04, Math.min(1, Number(fabric.roughness ?? 0.82))),
        metalness: Math.max(0, Math.min(1, Number(fabric.metalness ?? 0))),
        sheen: Math.max(0, Math.min(1, Number(fabric.sheen ?? 0.22))),
        sheenRoughness: Math.max(0.04, Math.min(1, Number(fabric.sheenRoughness ?? 0.84))),
        // Keep garment surfaces in the transparent render queue at full
        // opacity so they draw after the semi-transparent fitting avatar.
        // This avoids the avatar visually washing over correctly draped cloth.
        transparent: true,
        opacity: isInterfacing ? 0.30 : 1,
        depthWrite: !isInterfacing,
        polygonOffset: isInterfacing,
        polygonOffsetFactor: isInterfacing ? -1 : 0,
        polygonOffsetUnits: isInterfacing ? -1 : 0,
        wireframe: wireframeRef.current,
        vertexColors: analysisEnabled,
      })
      syncAnalysisColors(simPiece, geometry, analysisModeRef.current)
      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = `pattern-${simPiece.id}`
      mesh.renderOrder = isInterfacing ? 24 : 20
      mesh.castShadow = !isInterfacing
      mesh.receiveShadow = true
      mesh.visible = simPiece.piece.visible3d !== false
      scene.add(mesh)
      const meshRecord = { simPiece, geometry, material, mesh, fabricColor, fabricMap, normalMap, roughnessMap }
      meshRecordsRef.current.push(meshRecord)

      for (const graphic of simPiece.piece.graphics || []) {
        const graphicRecord = makeGraphicOverlay(meshRecord, graphic)
        if (graphicRecord) {
          graphicRecord.object.name = `graphic-${graphic.id}`
          scene.add(graphicRecord.object)
          trimRecordsRef.current.push(graphicRecord)
        }
      }

      for (const stitch of simPiece.piece.topstitches || []) {
        const indices = boundaryIndicesForEdge(simPiece, stitch.edgeIndex)
        const trimRecord = makeTrimLine(
          meshRecord,
          indices,
          new THREE.LineDashedMaterial({
            color: stitch.color || '#b2b2b2',
            dashSize: Math.max(0.003, Number(stitch.stitchLengthMm ?? 3) / 1000),
            gapSize: 0.0025,
            transparent: true,
            opacity: 0.96,
          }),
          0.0028,
        )
        if (trimRecord) {
          trimRecord.object.name = `topstitch-${stitch.id}`
          scene.add(trimRecord.object)
          trimRecordsRef.current.push(trimRecord)
        }
      }

      for (const binding of simPiece.piece.bindings || []) {
        const indices = boundaryIndicesForEdge(simPiece, binding.edgeIndex)
        const trimRecord = makeTrimLine(
          meshRecord,
          indices,
          new THREE.LineBasicMaterial({
            color: binding.color || '#666666',
            transparent: true,
            opacity: 0.94,
          }),
          0.0036,
        )
        if (trimRecord) {
          trimRecord.object.name = `binding-${binding.id}`
          scene.add(trimRecord.object)
          trimRecordsRef.current.push(trimRecord)
        }
      }

      for (const zipper of simPiece.piece.zippers || []) {
        const indices = boundaryIndicesForEdge(simPiece, zipper.edgeIndex)
        const trimRecord = makeTrimLine(
          meshRecord,
          indices,
          new THREE.LineDashedMaterial({
            color: zipper.color || '#c2c2c2',
            dashSize: 0.004,
            gapSize: 0.0015,
            transparent: true,
            opacity: 0.98,
          }),
          0.0042,
        )
        if (trimRecord) {
          trimRecord.object.name = `zipper-${zipper.id}`
          scene.add(trimRecord.object)
          trimRecordsRef.current.push(trimRecord)
        }
      }

      for (const button of simPiece.piece.buttons || []) {
        const radius = Math.max(0.004, Number(button.diameterCm ?? 1.8) * 0.005)
        const buttonMesh = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 16, 10),
          new THREE.MeshStandardMaterial({ color: button.color || '#222222', roughness: 0.48, metalness: 0.05 }),
        )
        buttonMesh.castShadow = true
        buttonMesh.renderOrder = 32
        const trimRecord = {
          type: 'button',
          object: buttonMesh,
          meshRecord,
          vertexIndex: nearestFlatVertexIndex(simPiece, button),
          lift: radius * 0.72,
        }
        syncSurfaceOverlay(trimRecord)
        buttonMesh.name = `button-${button.id}`
        scene.add(buttonMesh)
        trimRecordsRef.current.push(trimRecord)
      }

      for (const buttonhole of simPiece.piece.buttonholes || []) {
        const length = Math.max(0.006, Number(buttonhole.lengthCm ?? 2.4) * 0.01)
        const width = Math.max(0.0015, Number(buttonhole.widthCm ?? 0.35) * 0.01)
        const slotMesh = new THREE.Mesh(
          new THREE.BoxGeometry(length, width, 0.0012),
          new THREE.MeshStandardMaterial({ color: buttonhole.color || '#575757', roughness: 0.7, metalness: 0 }),
        )
        slotMesh.castShadow = false
        slotMesh.renderOrder = 33
        const trimRecord = {
          type: 'surface-object',
          object: slotMesh,
          meshRecord,
          vertexIndex: nearestFlatVertexIndex(simPiece, buttonhole),
          lift: 0.0045,
          orientationDeg: buttonhole.orientationDeg || 0,
        }
        syncSurfaceOverlay(trimRecord)
        slotMesh.name = `buttonhole-${buttonhole.id}`
        scene.add(slotMesh)
        trimRecordsRef.current.push(trimRecord)
      }
    }

    for (const fastener of project.fasteners || []) {
      const type = fastener.type || 'button'
      const radius = Math.max(0.004, Number(fastener.diameterCm ?? 1.8) * 0.005)
      for (const [role, endpoint] of [['a', fastener.a], ['b', fastener.b]]) {
        if (!endpoint) continue
        const meshRecord = meshRecordsRef.current.find((record) => record.simPiece.id === endpoint.pieceId)
        if (!meshRecord) continue
        const isPrimary = role === 'a'
        const hardwareRadius = isPrimary ? radius : radius * (type === 'button' ? 0.62 : 0.82)
        const hardware = new THREE.Mesh(
          new THREE.SphereGeometry(hardwareRadius, 16, 10),
          new THREE.MeshStandardMaterial({
            color: type === 'snap' ? '#b8b8b8' : type === 'hook' ? '#8d8d8d' : '#252525',
            roughness: type === 'button' ? 0.5 : 0.28,
            metalness: type === 'button' ? 0.05 : 0.72,
            transparent: fastener.closed === false,
            opacity: fastener.closed === false ? 0.58 : 1,
          }),
        )
        hardware.castShadow = true
        hardware.renderOrder = 34
        const trimRecord = {
          type: 'button',
          object: hardware,
          meshRecord,
          vertexIndex: nearestFlatVertexIndex(meshRecord.simPiece, endpoint),
          lift: hardwareRadius * 0.82,
        }
        syncSurfaceOverlay(trimRecord)
        hardware.name = `fastener-${fastener.id}-${role}`
        scene.add(hardware)
        trimRecordsRef.current.push(trimRecord)
      }
    }

    for (const seam of project.seams || []) {
      if (seam.type !== 'zipper') continue
      const meshRecord = meshRecordsRef.current.find((record) => record.simPiece.id === seam.a?.pieceId)
      if (!meshRecord) continue
      const edgeIndices = boundaryIndicesForEdge(meshRecord.simPiece, seam.a.edgeIndex)
      if (!edgeIndices.length) continue
      const openFraction = Math.max(0, Math.min(1, Number(seam.openFraction ?? 0)))
      const sliderT = seam.openFrom === 'start' ? openFraction : 1 - openFraction
      const edgeSlot = Math.max(0, Math.min(edgeIndices.length - 1, Math.round(sliderT * (edgeIndices.length - 1))))
      const vertexIndex = edgeIndices[edgeSlot]
      const sliderMaterial = new THREE.MeshStandardMaterial({ color: '#b9b9b9', roughness: 0.24, metalness: 0.78 })
      const slider = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, 0.005), sliderMaterial)
      slider.castShadow = true
      slider.renderOrder = 35
      const sliderRecord = {
        type: 'button',
        object: slider,
        meshRecord,
        vertexIndex,
        lift: 0.0062,
      }
      syncSurfaceOverlay(sliderRecord)
      slider.name = `zipper-slider-${seam.id}`
      scene.add(slider)
      trimRecordsRef.current.push(sliderRecord)

      const pull = new THREE.Mesh(
        new THREE.TorusGeometry(0.0055, 0.0012, 8, 18),
        new THREE.MeshStandardMaterial({ color: '#c8c8c8', roughness: 0.2, metalness: 0.82 }),
      )
      pull.castShadow = true
      pull.renderOrder = 36
      const pullRecord = {
        type: 'button',
        object: pull,
        meshRecord,
        vertexIndex,
        lift: 0.012,
      }
      syncSurfaceOverlay(pullRecord)
      pull.name = `zipper-pull-${seam.id}`
      scene.add(pull)
      trimRecordsRef.current.push(pullRecord)
    }

    return undefined
  }, [project.revision, project.previewSize, resetSignal, backendId])

  useEffect(() => {
    for (const record of meshRecordsRef.current) record.material.wireframe = Boolean(wireframe)
  }, [wireframe])

  useEffect(() => {
    if (!nativeSolveSignal || !simulationRef.current) return undefined
    const controller = new AbortController()
    let active = true
    onNativeSolveRef.current?.({ status: 'solving' })

    const solve = async () => {
      try {
        const response = await solveWithNativeService(projectRef.current, {
          frames: 60,
          clothModel: nativeClothModel,
          bendingModel: nativeBendingModel,
          signal: controller.signal,
        })
        if (!active) return
        const simulation = simulationRef.current
        for (const solvedPiece of response.result?.pieces || []) {
          const simPiece = simulation?.pieces?.get(solvedPiece.id)
          if (!simPiece || solvedPiece.vertices?.length !== simPiece.particles.length) {
            throw new Error(`Native solver topology mismatch for ${solvedPiece.id}`)
          }
          for (let index = 0; index < simPiece.particles.length; index += 1) {
            const vertex = solvedPiece.vertices[index]
            if (!vertex?.every?.(Number.isFinite)) throw new Error(`Native solver returned invalid vertex data for ${solvedPiece.id}`)
            simPiece.particles[index].position.set(vertex[0], vertex[1], vertex[2])
            simPiece.particles[index].previous.copy(simPiece.particles[index].position)
          }
        }
        simulation.elapsed = Number(response.result?.frames || 60) / 60
        refreshSimulationAnalysis(simulation, projectRef.current)
        for (const record of meshRecordsRef.current) {
          syncGeometry(record.simPiece, record.geometry, projectRef.current)
          syncAnalysisColors(record.simPiece, record.geometry, analysisModeRef.current)
        }
        for (const record of trimRecordsRef.current) syncSurfaceOverlay(record)
        onNativeSolveRef.current?.({
          status: 'done',
          elapsedMs: response.elapsedMs,
          stats: response.result?.stats || {},
          payload: response.payload || {},
        })
      } catch (error) {
        if (!active || error?.name === 'AbortError') return
        onNativeSolveRef.current?.({ status: 'error', error: error.message || String(error) })
      }
    }
    solve()
    return () => {
      active = false
      controller.abort()
    }
  }, [nativeSolveSignal])

  useEffect(() => {
    const analysisEnabled = analysisMode !== 'surface'
    for (const record of meshRecordsRef.current) {
      syncAnalysisColors(record.simPiece, record.geometry, analysisMode)
      record.material.vertexColors = analysisEnabled
      record.material.color.copy(analysisEnabled ? new THREE.Color(0xffffff) : record.fabricColor)
      record.material.map = analysisEnabled ? null : record.fabricMap
      record.material.normalMap = analysisEnabled ? null : record.normalMap
      record.material.roughnessMap = analysisEnabled ? null : record.roughnessMap
      record.material.needsUpdate = true
    }
  }, [analysisMode])

  useEffect(() => {
    if (!exportSignal || !meshRecordsRef.current.length || !onExportMeshRef.current) return
    const rows = [
      '# Garment Studio OBJ',
      '# Units: meters',
      `# Project: ${projectRef.current?.name || 'Untitled'}`,
    ]
    let vertexOffset = 1
    for (const record of meshRecordsRef.current) {
      const position = record.geometry.getAttribute('position')
      const index = record.geometry.getIndex()
      rows.push(`o ${String(record.simPiece.piece.name || record.simPiece.id).replace(/\s+/g, '_')}`)
      for (let i = 0; i < position.count; i += 1) {
        rows.push(`v ${position.getX(i).toFixed(6)} ${position.getY(i).toFixed(6)} ${position.getZ(i).toFixed(6)}`)
      }
      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          rows.push(`f ${vertexOffset + index.getX(i)} ${vertexOffset + index.getX(i + 1)} ${vertexOffset + index.getX(i + 2)}`)
        }
      } else {
        for (let i = 0; i < position.count; i += 3) rows.push(`f ${vertexOffset + i} ${vertexOffset + i + 1} ${vertexOffset + i + 2}`)
      }
      vertexOffset += position.count
    }
    onExportMeshRef.current(rows.join('\n'))
  }, [exportSignal])

  useEffect(() => {
    if (!glbExportSignal || !meshRecordsRef.current.length || !onExportGlbRef.current) return
    let cancelled = false
    const group = new THREE.Group()
    group.name = String(projectRef.current?.name || 'Garment').replace(/\s+/g, '_')
    for (const record of meshRecordsRef.current) {
      const mesh = new THREE.Mesh(record.geometry.clone(), record.material.clone())
      mesh.name = String(record.simPiece.piece.name || record.simPiece.id).replace(/\s+/g, '_')
      group.add(mesh)
    }
    const dispose = () => group.traverse((object) => {
      object.geometry?.dispose?.()
      object.material?.dispose?.()
    })
    void (async () => {
      try {
        // GLB export is an infrequent production action, so keep the exporter
        // out of the initial CAD bundle and load it only when requested.
        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
        if (cancelled) return dispose()
        const exporter = new GLTFExporter()
        exporter.parse(
          group,
          (result) => {
            if (!cancelled) onExportGlbRef.current?.(result)
            dispose()
          },
          (error) => {
            console.error('GLB export failed', error)
            dispose()
          },
          { binary: true, onlyVisible: true, trs: false },
        )
      } catch (error) {
        console.error('GLB exporter failed to load', error)
        dispose()
      }
    })()
    return () => { cancelled = true }
  }, [glbExportSignal])

  useEffect(() => {
    if (!renderSignal || !onRenderStillRef.current) return
    const renderer = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    const mount = mountRef.current
    if (!renderer || !scene || !camera || !mount) return
    const settings = projectRef.current.render || {}
    const width = Math.max(512, Math.min(6144, Math.round(Number(settings.widthPx ?? 2048))))
    const height = Math.max(512, Math.min(6144, Math.round(Number(settings.heightPx ?? 2560))))
    const oldSize = renderer.getSize(new THREE.Vector2())
    const oldPixelRatio = renderer.getPixelRatio()
    const oldAspect = camera.aspect
    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    const dataUrl = renderer.domElement.toDataURL('image/png')
    renderer.setPixelRatio(oldPixelRatio)
    renderer.setSize(oldSize.x, oldSize.y, false)
    camera.aspect = oldAspect
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    onRenderStillRef.current({ dataUrl, width, height })
  }, [renderSignal])

  return (
    <div className="viewport-shell">
      <div className="workspace-head viewport-head">
        <div>
          <strong>3D GARMENT</strong>
          <span>{running ? 'LIVE SIMULATION' : 'PAUSED'}</span>
        </div>
        <div className={`sim-indicator ${running ? 'active' : ''}`}><i />{running ? 'SOLVING' : 'READY'}</div>
      </div>
      <div ref={mountRef} className="three-mount" />
      {analysisMode !== 'surface' && (
        <div className={`analysis-legend ${analysisMode}`}>
          <span>{analysisMode === 'ease' ? 'TIGHT' : 'LOW'}</span><i /><span>{analysisMode === 'ease' ? 'LOOSE' : analysisMode === 'pressure' ? 'HIGH CONTACT' : 'HIGH STRAIN'}</span>
        </div>
      )}
      <div className="viewport-instructions">Orbit · drag &nbsp;&nbsp; Zoom · scroll &nbsp;&nbsp; Pan · right drag</div>
    </div>
  )
}
