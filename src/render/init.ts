import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import * as THREE from 'three'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EffectComposer, Pass } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import TickManager from './controllers/tick-manager'

// wasm
import Rapier from '@dimforge/rapier3d'
import AvatarController from './controllers/character-controller'
import { _addCapsule } from './controllers/utils/meshes'
import GeneralLoader from './loaders/general-loader'
import InitRapier from './physics/RAPIER'
import { PhysicsObject } from './physics/physics'
import { GRAVITY } from './physics/utils/constants'

const GUI = require('three/examples/jsm/libs/lil-gui.module.min.js').GUI

let scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  renderTarget: THREE.WebGLRenderTarget,
  composer: EffectComposer,
  controls: AvatarController,
  stats: Stats,
  gui: typeof GUI,
  renderWidth: number,
  renderHeight: number,
  renderAspectRatio: number,
  gltfLoader: GLTFLoader,
  textureLoader: THREE.TextureLoader,
  generalLoader: GeneralLoader,
  RAPIER: typeof Rapier,
  physicsWorld: Rapier.World,
  physicsObjects: Array<PhysicsObject>

const renderTickManager = new TickManager()

export const initEngine = async () => {
  // physics -> Rapier
  RAPIER = await InitRapier()
  physicsWorld = new RAPIER.World(GRAVITY)
  physicsObjects = [] // initializing physics objects array

  // rendering -> THREE.js
  scene = new THREE.Scene()

  renderWidth = window.innerWidth
  renderHeight = window.innerHeight

  renderAspectRatio = renderWidth / renderHeight

  camera = new THREE.PerspectiveCamera(75, renderAspectRatio, 0.01, 1000)
  camera.position.z = 5

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(renderWidth, renderHeight)
  renderer.setPixelRatio(window.devicePixelRatio * 1.5)

  // shadow
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  document.body.appendChild(renderer.domElement)

  renderTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
    samples: 8,
  })
  composer = new EffectComposer(renderer, renderTarget)
  composer.setSize(renderWidth, renderHeight)
  composer.setPixelRatio(renderer.getPixelRatio())

  const renderPass = new RenderPass(scene, camera)
  composer.addPass(renderPass)

  stats = Stats()
  document.body.appendChild(stats.dom)

  gui = new GUI()

  window.addEventListener(
    'resize',
    () => {
      renderWidth = window.innerWidth
      renderHeight = window.innerHeight
      renderAspectRatio = renderWidth / renderHeight

      renderer.setPixelRatio(window.devicePixelRatio)

      camera.aspect = renderAspectRatio
      camera.updateProjectionMatrix()

      renderer.setSize(renderWidth, renderHeight)
      composer.setSize(renderWidth, renderHeight)
    },
    false
  )

  // controls
  const capsule = _addCapsule(1.5, 0.5, 10, 10)
  controls = new AvatarController(capsule, camera)

  // config
  generalLoader = new GeneralLoader()

  gltfLoader = new GLTFLoader()
  textureLoader= new THREE.TextureLoader()

  // Install GLTFLoader plugin
  gltfLoader.register((parser) => {
    // vrm loader setup
    return new VRMLoaderPlugin(parser)
  })

  renderTickManager.startLoop()
}

export const useRenderer = () => renderer

export const useRenderSize = () => ({ width: renderWidth, height: renderHeight })

export const useScene = () => scene

export const useCamera = () => camera

export const useControls = () => controls

export const useStats = () => stats

export const useRenderTarget = () => renderTarget

export const useComposer = () => composer

export const useGui = () => gui

export const addPass = (pass: Pass) => {
  composer.addPass(pass)
}

export const useTick = (fn: Function) => {
  if (renderTickManager) {
    const _tick = (e: any) => {
      fn(e.data)
    }
    renderTickManager.addEventListener('tick', _tick)
  }
}

export const useGltfLoader = () => gltfLoader
export const useTextureLoader = () => textureLoader
export const useLoader = () => generalLoader
export const usePhysics = () => physicsWorld
export const usePhysicsObjects = () => physicsObjects

export { RAPIER }
