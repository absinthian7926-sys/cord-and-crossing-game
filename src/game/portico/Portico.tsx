import { useFrame } from '@react-three/fiber'
import {
  BallCollider,
  CuboidCollider,
  RigidBody,
  useBeforePhysicsStep,
  type RapierCollider,
} from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Frustum,
  Matrix4,
  ShaderMaterial,
  Vector3,
  type Group,
} from 'three'
import { PLAYER } from '../../data/player'
import { ZONE } from '../../data/zone'
import {
  registerCameraExcludedCollider,
  unregisterCameraExcludedCollider,
} from '../player/cameraCollisionRegistry'
import { playerStore } from '../player/playerStore'
import {
  createCrossingResult,
  createCrossingState,
  stepCrossing,
  type CrossingInput,
  type CrossingResult,
  type CrossingState,
} from './crossing'
import {
  dispatchPorticoCrossing,
  isKeyUsePositionNearby,
  mapPorticoCrossingDirection,
  setKeyUseNearby,
  setKeyUseNearbyTransient,
  setPorticoScreenInView,
  toRippleUvPerSecond,
  type PorticoDirection,
} from './porticoRuntime'

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uEdgeColor;
  uniform float uSoftEdge;
  uniform float uRippleSpeed;
  uniform float uVerticalFrequency;
  uniform float uHorizontalPhase;
  uniform float uBodyBase;
  uniform float uBodyAmplitude;
  uniform float uEdgeWeight;
  varying vec2 vUv;

  void main() {
    float edgeDistance = min(vUv.x, 1.0 - vUv.x);
    float edge = 1.0 - smoothstep(0.0, uSoftEdge, edgeDistance);
    float ripple = 0.5 + 0.5 * sin(
      (vUv.y - uTime * uRippleSpeed) * uVerticalFrequency +
      vUv.x * uHorizontalPhase
    );
    float body = uBodyBase + ripple * uBodyAmplitude;
    float alpha = uOpacity * min(1.0, edge * uEdgeWeight + body);
    gl_FragColor = vec4(uEdgeColor, alpha);
  }
`

export type PorticoCrossingSample = CrossingInput

export type PorticoProps = {
  readonly kind: 'zone' | 'hollow'
  readonly center: readonly [number, number, number]
  readonly normal: readonly [number, number, number]
  readonly active: boolean
  readonly keyUseEnabled?: boolean
  readonly onValidCrossing?: (direction: PorticoDirection) => void
}

function registerSensor(collider: RapierCollider | null): (() => void) | void {
  if (!collider) return
  registerCameraExcludedCollider(collider.handle)
  return () => unregisterCameraExcludedCollider(collider.handle)
}

export function Portico({
  kind,
  center,
  normal,
  active,
  keyUseEnabled = false,
  onValidCrossing,
}: PorticoProps) {
  const root = useRef<Group>(null)
  const material = useRef<ShaderMaterial>(null)
  const keySensor = useRef<RapierCollider>(null)
  const frontSensor = useRef<RapierCollider>(null)
  const backSensor = useRef<RapierCollider>(null)
  const callback = useRef(onValidCrossing)
  const crossingState = useRef<CrossingState>(createCrossingState())
  const crossingResult = useRef<CrossingResult>(createCrossingResult())
  const crossingInput = useRef<PorticoCrossingSample>({
    minimumAlongNormal: 0,
    maximumAlongNormal: 0,
    withinOpening: false,
  })
  const fade = useRef(active ? 1 : 0)
  const keyNearby = useRef(false)
  const viewProjection = useMemo(
    () => (import.meta.env.DEV ? new Matrix4() : null),
    [],
  )
  const viewFrustum = useMemo(
    () => (import.meta.env.DEV ? new Frustum() : null),
    [],
  )
  const screenPoint = useMemo(
    () => (import.meta.env.DEV ? new Vector3() : null),
    [],
  )

  const normalLength = Math.max(
    Number.EPSILON,
    Math.hypot(normal[0], normal[2]),
  )
  const normalX = normal[0] / normalLength
  const normalZ = normal[2] / normalLength
  const lateralX = -normalZ
  const lateralZ = normalX
  const yaw = Math.atan2(normalX, normalZ)
  const pillarHalfWidth = ZONE.placeholders.ruin.pillarSize[0] / 2
  const pillarHalfHeight = ZONE.portico.pillarHeight / 2
  const pillarHalfDepth = ZONE.placeholders.ruin.pillarSize[2] / 2
  const openingHalfWidth = ZONE.portico.screenWidth / 2 - PLAYER.collider.radius

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uEdgeColor: { value: new Color(ZONE.portico.shimmer.edgeColor) },
      uSoftEdge: {
        value: ZONE.portico.shimmer.softEdgeWidth / ZONE.portico.screenWidth,
      },
      uRippleSpeed: {
        value: toRippleUvPerSecond(
          ZONE.portico.shimmer.rippleSpeed,
          ZONE.portico.screenHeight,
        ),
      },
      uVerticalFrequency: {
        value: ZONE.portico.shimmer.verticalFrequency,
      },
      uHorizontalPhase: { value: ZONE.portico.shimmer.horizontalPhase },
      uBodyBase: { value: ZONE.portico.shimmer.bodyBase },
      uBodyAmplitude: { value: ZONE.portico.shimmer.bodyAmplitude },
      uEdgeWeight: { value: ZONE.portico.shimmer.edgeWeight },
    }),
    [],
  )

  useEffect(() => {
    callback.current = onValidCrossing
  }, [onValidCrossing])

  useEffect(() => {
    const unregisterKey = registerSensor(keySensor.current)
    const unregisterFront = registerSensor(frontSensor.current)
    const unregisterBack = registerSensor(backSensor.current)
    return () => {
      unregisterKey?.()
      unregisterFront?.()
      unregisterBack?.()
      if (kind === 'zone') {
        setKeyUseNearby(false)
        setKeyUseNearbyTransient(false)
        setPorticoScreenInView(false)
      }
    }
  }, [keyUseEnabled, kind])

  useEffect(() => {
    if (active) return
    crossingState.current = createCrossingState()
    crossingResult.current = createCrossingResult()
  }, [active])

  useBeforePhysicsStep(() => {
    if (!active) return
    const player = playerStore.getState().position
    const offsetX = player.x - center[0]
    const offsetZ = player.z - center[2]
    const alongNormal = offsetX * normalX + offsetZ * normalZ
    const lateral = Math.abs(offsetX * lateralX + offsetZ * lateralZ)
    const capsuleHalfHeight =
      PLAYER.collider.halfHeight + PLAYER.collider.radius
    const playerBottom = player.y - capsuleHalfHeight
    const playerTop = player.y + capsuleHalfHeight
    const withinHeight =
      playerBottom <= center[1] + ZONE.portico.screenHeight &&
      playerTop >= center[1]
    const input = crossingInput.current
    input.minimumAlongNormal = alongNormal - PLAYER.collider.radius
    input.maximumAlongNormal = alongNormal + PLAYER.collider.radius
    input.withinOpening = lateral <= openingHalfWidth && withinHeight
    const result = stepCrossing(
      crossingState.current,
      input,
      ZONE.portico.triggerOffset,
      crossingResult.current,
    )
    if (result.status !== 'valid' || result.direction === null) return
    const direction = mapPorticoCrossingDirection(kind, result.direction)
    if (callback.current) callback.current(direction)
    else dispatchPorticoCrossing(direction)
  })

  useFrame(({ camera }, delta) => {
    const shader = material.current
    if (shader) {
      shader.uniforms.uTime.value += delta
      const target = active ? 1 : 0
      const step = delta / ZONE.portico.shimmer.fadeSeconds
      fade.current =
        target > fade.current
          ? Math.min(target, fade.current + step)
          : Math.max(target, fade.current - step)
      shader.uniforms.uOpacity.value =
        fade.current * ZONE.portico.shimmer.opacity
    }

    if (
      import.meta.env.DEV &&
      kind === 'zone' &&
      viewProjection &&
      viewFrustum &&
      screenPoint
    ) {
      viewProjection.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      )
      viewFrustum.setFromProjectionMatrix(viewProjection)
      screenPoint.set(
        center[0],
        center[1] + ZONE.portico.screenHeight / 2,
        center[2],
      )
      const cameraOffsetX = camera.position.x - center[0]
      const cameraOffsetZ = camera.position.z - center[2]
      const horizontalDistance = Math.max(
        Number.EPSILON,
        Math.hypot(cameraOffsetX, cameraOffsetZ),
      )
      const normalDot = Math.abs(
        (cameraOffsetX * normalX + cameraOffsetZ * normalZ) /
          horizontalDistance,
      )
      setPorticoScreenInView(
        active &&
          normalDot >= ZONE.portico.shimmer.measuredViewNormalDot &&
          viewFrustum.containsPoint(screenPoint),
      )
    }

    if (!keyUseEnabled || kind !== 'zone') return
    const player = playerStore.getState().position
    const nearby = isKeyUsePositionNearby(
      player.x,
      player.z,
      center[0],
      center[2],
      normalX,
      normalZ,
      ZONE.portico.keyUseRadius,
    )
    if (nearby === keyNearby.current) return
    keyNearby.current = nearby
    setKeyUseNearby(nearby)
  })

  return (
    <group ref={root} name={`${kind}-portico`}>
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((side) => {
          const offset = (side * ZONE.portico.pillarSpacing) / 2
          return (
            <CuboidCollider
              key={side}
              args={[pillarHalfWidth, pillarHalfHeight, pillarHalfDepth]}
              position={[
                center[0] + lateralX * offset,
                center[1] + pillarHalfHeight,
                center[2] + lateralZ * offset,
              ]}
              rotation={[0, yaw, 0]}
            />
          )
        })}
      </RigidBody>
      {[-1, 1].map((side) => {
        const offset = (side * ZONE.portico.pillarSpacing) / 2
        return (
          <mesh
            key={side}
            castShadow
            receiveShadow
            position={[
              center[0] + lateralX * offset,
              center[1] + pillarHalfHeight,
              center[2] + lateralZ * offset,
            ]}
            rotation={[0, yaw, 0]}
          >
            <boxGeometry args={ZONE.placeholders.ruin.pillarSize} />
            <meshStandardMaterial color={ZONE.palette.stone} roughness={1} />
          </mesh>
        )
      })}

      <mesh
        visible={active || fade.current > 0}
        position={[
          center[0],
          center[1] + ZONE.portico.screenHeight / 2,
          center[2],
        ]}
        rotation={[0, yaw, 0]}
      >
        <planeGeometry
          args={[ZONE.portico.screenWidth, ZONE.portico.screenHeight]}
        />
        {/* PLACEHOLDER: cheap ripple screen pending the M7 visual pass. */}
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>

      <RigidBody type="fixed" colliders={false}>
        {keyUseEnabled && kind === 'zone' && (
          <BallCollider
            ref={keySensor}
            args={[ZONE.portico.keyUseRadius]}
            position={[
              center[0] + normalX * ZONE.portico.keyUseRadius * 0.5,
              center[1] + PLAYER.collider.halfHeight,
              center[2] + normalZ * ZONE.portico.keyUseRadius * 0.5,
            ]}
            sensor
          />
        )}
        <CuboidCollider
          ref={frontSensor}
          args={[
            ZONE.portico.screenWidth / 2,
            ZONE.portico.screenHeight / 2,
            ZONE.portico.triggerDepth / 2,
          ]}
          position={[
            center[0] - normalX * ZONE.portico.triggerOffset,
            center[1] + ZONE.portico.screenHeight / 2,
            center[2] - normalZ * ZONE.portico.triggerOffset,
          ]}
          rotation={[0, yaw, 0]}
          sensor
        />
        <CuboidCollider
          ref={backSensor}
          args={[
            ZONE.portico.screenWidth / 2,
            ZONE.portico.screenHeight / 2,
            ZONE.portico.triggerDepth / 2,
          ]}
          position={[
            center[0] + normalX * ZONE.portico.triggerOffset,
            center[1] + ZONE.portico.screenHeight / 2,
            center[2] + normalZ * ZONE.portico.triggerOffset,
          ]}
          rotation={[0, yaw, 0]}
          sensor
        />
      </RigidBody>
    </group>
  )
}
