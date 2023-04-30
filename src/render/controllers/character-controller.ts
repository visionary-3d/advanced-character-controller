import * as THREE from 'three'
import { Object3D } from 'three'
import { RAPIER, usePhysics, useScene } from '../init'
import { useRenderer } from './../init'
import { PhysicsObject, addPhysics } from '../physics/physics'
import Rapier from '@dimforge/rapier3d'
import { GRAVITY } from '../physics/utils/constants'
import { _calculateObjectSize } from './utils/objects'
import { clamp, lerp, easeOutExpo, EaseOutCirc, UpDownCirc } from './utils/math'

// * helpers
const HALF_PI = Math.PI / 2
const FORWARD = new THREE.Vector3(0, 0, -1)
const LEFT = new THREE.Vector3(-1, 0, 0)
const UP = new THREE.Vector3(0, 1, 0)
const RIGHT = new THREE.Vector3(1, 0, 0)
const DOWN = new THREE.Vector3(0, -1, 0)

// * constants
const MIN_ZOOM_LEVEL = 0.001 // needs to be slightly bigger than zero
const MAX_ZOOM_LEVEL = 20
const SCROLL_LEVEL_STEP = 1.5
const SCROLL_ANIMATION_SPEED = 2
const JUMP_DURATION = 0.5
const JUMP_AMPLITUDE = 0.5

// * local variables
const quaternion_0 = new THREE.Quaternion()
const quaternion_1 = new THREE.Quaternion()
const vec3_0 = new THREE.Vector3()
const vec3_1 = new THREE.Vector3()
let ray_0: Rapier.Ray

// * helper functions
const ONE = () => {
  return 1
}
const FIVE = () => {
  return 5
}
const ZERO = () => {
  return 0
}

// * supported keyboard keys
enum KEYS {
  a = 'KeyA',
  s = 'KeyS',
  w = 'KeyW',
  d = 'KeyD',
  space = 'Space',
  shiftL = 'ShiftLeft',
  shiftR = 'ShiftRight',
}

type MouseState = {
  leftButton: boolean
  rightButton: boolean
  mouseXDelta: number
  mouseYDelta: number
  mouseWheelDelta: number
}

// * Responsible for the inputs of the user
class InputManager {
  target: Document
  currentMouse: MouseState
  currentKeys: Map<string, boolean> 
  pointerLocked: boolean

  constructor(target?: Document) {
    this.target = target || document
    this.currentMouse = {
      leftButton: false,
      rightButton: false,
      mouseXDelta: 0,
      mouseYDelta: 0,
      mouseWheelDelta: 0,
    }
    this.currentKeys = new Map<string, boolean>()
    this.pointerLocked = false

    this.init()
  }

  init() {
    // mouse event handlers
    this.target.addEventListener('mousedown', (e) => this.onMouseDown(e), false)
    this.target.addEventListener('mousemove', (e) => this.onMouseMove(e), false)
    this.target.addEventListener('mouseup', (e) => this.onMouseUp(e), false)
    // mouse wheel
    addEventListener('wheel', (e) => this.onMouseWheel(e), false)

    // keyboard event handlers
    this.target.addEventListener('keydown', (e) => this.onKeyDown(e), false)
    this.target.addEventListener('keyup', (e) => this.onKeyUp(e), false)

    const renderer = useRenderer()

    // handling pointer lock
    const addPointerLockEvent = async () => {
      await renderer.domElement.requestPointerLock()
    }
    renderer.domElement.addEventListener('click', addPointerLockEvent)
    renderer.domElement.addEventListener('dblclick', addPointerLockEvent)
    renderer.domElement.addEventListener('mousedown', addPointerLockEvent)

    const setPointerLocked = () => {
      this.pointerLocked = document.pointerLockElement === renderer.domElement
    }
    document.addEventListener('pointerlockchange', setPointerLocked, false)
  }

  onMouseWheel(e: WheelEvent) {
    const changeMouseWheelLevel = () => {
      if (this.pointerLocked) {
        if (e.deltaY < 0) {
          // * scrolling up, zooming in
          this.currentMouse.mouseWheelDelta = Math.max(
            this.currentMouse.mouseWheelDelta - SCROLL_LEVEL_STEP,
            MIN_ZOOM_LEVEL
          )
        } else if (e.deltaY > 0) {
          // * scrolling down, zooming out
          this.currentMouse.mouseWheelDelta = Math.min(
            this.currentMouse.mouseWheelDelta + SCROLL_LEVEL_STEP,
            MAX_ZOOM_LEVEL
          )
        }
      }
    }

    changeMouseWheelLevel()
  }

  onMouseMove(e: MouseEvent) {
    if (this.pointerLocked) {
      this.currentMouse.mouseXDelta = e.movementX
      this.currentMouse.mouseYDelta = e.movementY
    }
  }

  onMouseDown(e: MouseEvent) {
    if (this.pointerLocked) {
      this.onMouseMove(e)

      // * right click, left click
      switch (e.button) {
        case 0: {
          this.currentMouse.leftButton = true
          break
        }
        case 2: {
          this.currentMouse.rightButton = true
          break
        }
      }
    }
  }

  onMouseUp(e: MouseEvent) {
    if (this.pointerLocked) {
      this.onMouseMove(e)

      // * right click, left click
      switch (e.button) {
        case 0: {
          this.currentMouse.leftButton = false
          break
        }
        case 2: {
          this.currentMouse.rightButton = false
          break
        }
      }
    }
  }

  onKeyDown(e: KeyboardEvent) {
    if (this.pointerLocked) {
      this.currentKeys.set(e.code, true)
    }
  }

  onKeyUp(e: KeyboardEvent) {
    if (this.pointerLocked) {
      this.currentKeys.set(e.code, false)
    }
  }

  isKeyDown(keyCode: string | number) {
    if (this.pointerLocked) {
      const hasKeyCode = this.currentKeys.get(keyCode as string)
      if (hasKeyCode) {
        return hasKeyCode
      }
    }

    return false
  }

  update() {
    this.currentMouse.mouseXDelta = 0
    this.currentMouse.mouseYDelta = 0
  }

  runActionByKey(key: string, action: Function, inAction?: Function) {
    // * run function if the key is pressed
    if (this.isKeyDown(key)) {
      return action()
    } else {
      return inAction && inAction()
    }
  }

  runActionByOneKey(keys: Array<string>, action: Function, inAction?: Function) {
    // * run the function if one of the keys in the 'keys' array is pressed
    let check = false
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      check = this.isKeyDown(key)

      if (check) {
        break
      }
    }

    if (check) {
      return action()
    } else {
      return inAction && inAction()
    }
  }

  runActionByAllKeys(keys: Array<string>, action: Function, inAction?: Function) {
    // * if all of the keys in the 'keys' array are pressed at the same time, run the function
    let check = true
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      check = this.isKeyDown(key)

      if (!check) {
        break
      }
    }

    if (check) {
      return action()
    } else {
      return inAction && inAction()
    }
  }
}

// * Responsible for the Head Bob (up and down) movement of the character (only works in first-person-mode)
class HeadBobController {
  headBobTimer: number
  headBobAmount: number
  lastHeadBobDiff: number
  headBobActive: boolean

  constructor() {
    this.headBobTimer = 0
    this.lastHeadBobDiff = 0
    this.headBobAmount = 0
    this.headBobActive = false
  }

  getHeadBob(timeDiff: number, isMoving: boolean) {
    const HEAD_BOB_DURATION = 0.1
    const HEAD_BOB_FREQUENCY = 0.8
    const HEAD_BOB_AMPLITUDE = 0.3

    if (!this.headBobActive) {
      this.headBobActive = isMoving
    }

    if (this.headBobActive) {
      const STEP = Math.PI

      const currentAmount = this.headBobTimer * HEAD_BOB_FREQUENCY * (1 / HEAD_BOB_DURATION)
      const headBobDiff = currentAmount % STEP

      this.headBobTimer += timeDiff
      this.headBobAmount = Math.sin(currentAmount) * HEAD_BOB_AMPLITUDE

      if (headBobDiff < this.lastHeadBobDiff) {
        this.headBobActive = false
      }

      this.lastHeadBobDiff = headBobDiff
    }

    return this.headBobAmount
  }
}

// * Responsible for the camera zoom on the character (first-person-mode and third-person-mode)
class ZoomController {
  zoom: number
  lastZoomLevel: number
  startZoomAnimation: number
  isAnimating: boolean
  startingZoom: number

  constructor() {
    this.zoom = MIN_ZOOM_LEVEL
    this.startingZoom = 0
    this.lastZoomLevel = 0
    this.startZoomAnimation = 0
    this.isAnimating = false
  }

  update(zoomLevel: number, timestamp: number, timeDiff: number) {
    const time = timestamp * SCROLL_ANIMATION_SPEED
    const zlClamped = clamp(zoomLevel, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL)

    const zoomLevelHasChanged = this.lastZoomLevel !== zoomLevel
    if (zoomLevelHasChanged) {
      // restart the animation
      this.startingZoom = this.zoom
      this.startZoomAnimation = time
      this.isAnimating = true
    }

    // animating
    if (this.isAnimating) {
      const progress = time - this.startZoomAnimation
      this.zoom = lerp(this.startingZoom, zlClamped, easeOutExpo(progress))

      if (progress >= 1) {
        // end the animation
        this.isAnimating = false
      }
    }

    this.lastZoomLevel = zoomLevel
  }
}

// * Responsible for controlling the vertical movement of the character (gravity, jump, etc...)
class HeightController {
  height: number
  lastHeight: number
  movePerFrame: number
  lastGroundHeight: number
  startFallAnimation: number
  isAnimating: boolean
  grounded: boolean
  jumpFactor: number
  startJumpAnimation: number

  constructor() {
    this.height = 0
    this.lastHeight = this.height
    this.movePerFrame = 0
    this.lastGroundHeight = this.height
    this.startFallAnimation = 0
    this.startJumpAnimation = 0
    this.jumpFactor = 0
    this.isAnimating = false
    this.grounded = false
  }

  update(timestamp: number, timeDiff: number) {
    this.isAnimating = !this.grounded

    if (this.isAnimating) {
      const t = timestamp - this.startFallAnimation

      this.height = 0.5 * GRAVITY.y * t * t

      this.movePerFrame = this.height - this.lastHeight
    } else {
      // reset the animation
      this.height = 0
      this.lastHeight = 0
      this.movePerFrame = 0
      this.startFallAnimation = timestamp
    }

    const jt = timestamp - this.startJumpAnimation
    if (this.grounded && jt > JUMP_DURATION) {
      this.jumpFactor = 0
      this.startJumpAnimation = timestamp
    } else {
      this.movePerFrame += lerp(
        0,
        this.jumpFactor * JUMP_AMPLITUDE,
        UpDownCirc(clamp(jt / JUMP_DURATION, 0, 1))
      )
    }

    this.lastHeight = this.height
  }

  setGrounded(grounded: boolean) {
    this.grounded = grounded
  }

  setJumpFactor(jumpFactor: number) {
    this.jumpFactor = jumpFactor
  }
}

// * Responsible for controlling the character movement, rotation and physics
class CharacterController extends THREE.Mesh {
  camera: THREE.PerspectiveCamera
  inputManager: InputManager
  headBobController: HeadBobController
  heightController: HeightController
  phi: number
  theta: number
  objects: any
  isMoving2D: boolean
  startZoomAnimation: number
  zoomController: ZoomController
  physicsObject: PhysicsObject
  // characterController: Rapier.KinematicCharacterController
  avatar: AvatarController

  constructor(avatar: AvatarController, camera: THREE.PerspectiveCamera) {
    super()

    // init position
    this.position.copy(avatar.avatar.position)

    this.camera = camera
    this.avatar = avatar

    this.inputManager = new InputManager()
    this.headBobController = new HeadBobController()
    this.zoomController = new ZoomController()
    this.heightController = new HeightController()

    // physics
    this.physicsObject = this.initPhysics(avatar)

    // ! Rapier's character controller is bugged
    // // The gap the controller will leave between the character and its environment.
    // const OFFSET = 0.01
    // this.characterController = physics.createCharacterController(OFFSET)

    this.startZoomAnimation = 0

    this.phi = 0
    this.theta = 0

    this.isMoving2D = false
  }

  initPhysics(avatar: AvatarController) {
    // initialize ray
    ray_0 = new RAPIER.Ray(vec3_0, vec3_0)

    // physics object
    const radius = avatar.width / 2
    const halfHeight = avatar.height / 2 - radius
    const physicsObject = addPhysics(this, 'kinematicPositionBased', false, undefined, 'capsule', {
      halfHeight,
      radius,
    })

    return physicsObject
  }

  detectGround() {
    const physics = usePhysics()
    const avatarHalfHeight = this.avatar.height / 2

    // set collider position
    const colliderPosition = vec3_0.copy(this.position)
    this.physicsObject.collider.setTranslation(colliderPosition)

    // hitting the ground
    const rayOrigin = vec3_1.copy(this.position)
    // ray origin is at the foot of the avatar
    rayOrigin.y -= avatarHalfHeight

    const ray = ray_0
    ray.origin = rayOrigin
    ray.dir = DOWN

    const groundUnderFootHit = physics.castRay(
      ray,
      1000,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC,
      undefined,
      this.physicsObject.collider,
      this.physicsObject.rigidBody
    )

    if (groundUnderFootHit) {
      const hitPoint = ray.pointAt(groundUnderFootHit.toi) as THREE.Vector3
      const distance = rayOrigin.y - hitPoint.y
      if (distance <= 0) {
        // * Grounded
        this.heightController.setGrounded(true)
      } else {
        this.heightController.lastGroundHeight = hitPoint.y + avatarHalfHeight
        this.heightController.setGrounded(false)
      }
    } else {
      // * Shoot another ray up to see if we've passed the ground
      ray.dir = UP
      const groundAboveFootHit = physics.castRay(
        ray,
        this.avatar.height / 2,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC,
        undefined,
        this.physicsObject.collider,
        this.physicsObject.rigidBody
      )

      if (groundAboveFootHit) {
        // * passed the ground
        this.position.y = this.heightController.lastGroundHeight
        this.heightController.setGrounded(true)
      } else {
        this.heightController.setGrounded(false)
      }
    }

    // ! Rapier.js character controller is bugged
    {
      // this.characterController.computeColliderMovement(
      //   this.physicsObject.collider, // The collider we would like to move.
      //   this.position // The movement we would like to apply if there wasn’t any obstacle.
      // )
      // // Read the result
      // const correctedMovement = this.characterController.computedMovement()
      // this.position.copy(correctedMovement as THREE.Vector3)
    }
  }

  update(timestamp: number, timeDiff: number) {
    this.updateRotation()
    this.updateTranslation(timeDiff)
    this.updateGravity(timestamp, timeDiff)
    this.detectGround()
    this.updateZoom(timestamp, timeDiff)
    this.updateCamera(timestamp, timeDiff)
    this.inputManager.update()
  }

  updateZoom(timestamp: number, timeDiff: number) {
    this.zoomController.update(
      this.inputManager.currentMouse.mouseWheelDelta,
      timestamp,
      timeDiff
    )
  }

  updateGravity(timestamp: number, timeDiff: number) {
    this.heightController.update(timestamp, timeDiff)
  }

  updateCamera(timestamp: number, timeDiff: number) {
    this.camera.position.copy(this.position)
    // this.camera.position.y += this.avatar.height / 2

    // moving by the camera angle
    const circleRadius = this.zoomController.zoom
    const cameraOffset = vec3_0.set(
      circleRadius * Math.cos(-this.phi),
      circleRadius * Math.cos(this.theta + HALF_PI),
      circleRadius * Math.sin(-this.phi)
    )
    this.camera.position.add(cameraOffset)
    this.camera.lookAt(this.position)

    // head bob
    const isFirstPerson = this.zoomController.zoom <= this.avatar.width
    if (isFirstPerson) {
      this.camera.position.y += this.headBobController.getHeadBob(timeDiff, this.isMoving2D)

      // keep looking at the same position in the object in front
      const physics = usePhysics()

      const rayOrigin = vec3_1.copy(this.camera.position)
      const rayDirection = vec3_0.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize()
      const ray = ray_0
      ray.origin = rayOrigin
      ray.dir = rayDirection

      const hit = physics.castRay(ray, 1000, false)

      if (hit) {
        const point = ray.pointAt(hit.toi)
        const hitPoint = vec3_0.set(point.x, point.y, point.z)
        this.camera.lookAt(hitPoint)
      }
    }
  }

  updateTranslation(timeDiff: number) {
    const timeDiff_d10 = timeDiff * 10

    const shiftSpeedUpAction = () =>
      this.inputManager.runActionByOneKey([KEYS.shiftL, KEYS.shiftR], FIVE, ONE)

    const forwardVelocity =
      this.inputManager.runActionByKey(KEYS.w, shiftSpeedUpAction, ZERO) -
      this.inputManager.runActionByKey(KEYS.s, shiftSpeedUpAction, ZERO)

    const sideVelocity =
      this.inputManager.runActionByKey(KEYS.a, shiftSpeedUpAction, ZERO) -
      this.inputManager.runActionByKey(KEYS.d, shiftSpeedUpAction, ZERO)

    const qx = quaternion_1
    qx.setFromAxisAngle(UP, this.phi + HALF_PI)

    vec3_0.copy(FORWARD)
    vec3_0.applyQuaternion(qx)
    vec3_0.multiplyScalar(forwardVelocity * timeDiff_d10)

    vec3_1.copy(LEFT)
    vec3_1.applyQuaternion(qx)
    vec3_1.multiplyScalar(sideVelocity * timeDiff_d10)

    this.position.add(vec3_0)
    this.position.add(vec3_1)

    // Height
    const elevationFactor = this.inputManager.runActionByKey(KEYS.space, ONE, ZERO)

    // Jump
    if (this.heightController.grounded) {
      this.heightController.setJumpFactor(elevationFactor)
    }

    this.position.y += this.heightController.movePerFrame

    this.isMoving2D = forwardVelocity != 0 || sideVelocity != 0
  }

  updateRotation() {
    const xh = this.inputManager.currentMouse.mouseXDelta / window.innerWidth
    const yh = this.inputManager.currentMouse.mouseYDelta / window.innerHeight

    const PHI_SPEED = 2.5
    const THETA_SPEED = 2.5
    this.phi += -xh * PHI_SPEED
    this.theta = clamp(this.theta + -yh * THETA_SPEED, -Math.PI / 2, Math.PI / 2)

    const qx = quaternion_0
    qx.setFromAxisAngle(UP, this.phi)
    const qz = quaternion_1
    qz.setFromAxisAngle(RIGHT, this.theta)

    const q = qx.multiply(qz)

    this.quaternion.copy(q)
  }
}

// * Responsible for controlling the avatar mesh and the character controller
class AvatarController {
  avatar: THREE.Mesh
  characterController: CharacterController
  height: number
  width: number

  constructor(avatar: THREE.Mesh, camera: THREE.PerspectiveCamera) {
    this.avatar = avatar

    const size = _calculateObjectSize(avatar)
    this.width = size.x
    this.height = size.y
    this.characterController = new CharacterController(this, camera)
  }

  update(timestamp: number, timeDiff: number) {
    this.characterController.update(timestamp, timeDiff)
    this.avatar.position.copy(this.characterController.position)
  }
}

export default AvatarController
