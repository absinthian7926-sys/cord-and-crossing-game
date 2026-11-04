function shape(positions, normals, indices) {
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  }
}

export function box() {
  const positions = []
  const normals = []
  const indices = []
  const faces = [
    [
      [0, 0, 1],
      [
        [-0.5, -0.5, 0.5],
        [0.5, -0.5, 0.5],
        [0.5, 0.5, 0.5],
        [-0.5, 0.5, 0.5],
      ],
    ],
    [
      [0, 0, -1],
      [
        [0.5, -0.5, -0.5],
        [-0.5, -0.5, -0.5],
        [-0.5, 0.5, -0.5],
        [0.5, 0.5, -0.5],
      ],
    ],
    [
      [1, 0, 0],
      [
        [0.5, -0.5, 0.5],
        [0.5, -0.5, -0.5],
        [0.5, 0.5, -0.5],
        [0.5, 0.5, 0.5],
      ],
    ],
    [
      [-1, 0, 0],
      [
        [-0.5, -0.5, -0.5],
        [-0.5, -0.5, 0.5],
        [-0.5, 0.5, 0.5],
        [-0.5, 0.5, -0.5],
      ],
    ],
    [
      [0, 1, 0],
      [
        [-0.5, 0.5, 0.5],
        [0.5, 0.5, 0.5],
        [0.5, 0.5, -0.5],
        [-0.5, 0.5, -0.5],
      ],
    ],
    [
      [0, -1, 0],
      [
        [-0.5, -0.5, -0.5],
        [0.5, -0.5, -0.5],
        [0.5, -0.5, 0.5],
        [-0.5, -0.5, 0.5],
      ],
    ],
  ]
  for (const [normal, vertices] of faces) {
    const offset = positions.length / 3
    for (const vertex of vertices) {
      positions.push(...vertex)
      normals.push(...normal)
    }
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3)
  }
  return shape(positions, normals, indices)
}

export function cylinder(
  radialSegments = 8,
  topRadius = 0.5,
  bottomRadius = 0.5,
) {
  const positions = []
  const normals = []
  const indices = []
  for (let ring = 0; ring < 2; ring += 1) {
    const y = ring === 0 ? -0.5 : 0.5
    const radius = ring === 0 ? bottomRadius : topRadius
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2
      const x = Math.cos(angle)
      const z = Math.sin(angle)
      positions.push(x * radius, y, z * radius)
      normals.push(x, 0, z)
    }
  }
  for (let segment = 0; segment < radialSegments; segment += 1) {
    const next = (segment + 1) % radialSegments
    indices.push(segment, next, radialSegments + next)
    indices.push(segment, radialSegments + next, radialSegments + segment)
  }
  const bottomCenter = positions.length / 3
  positions.push(0, -0.5, 0)
  normals.push(0, -1, 0)
  const topCenter = positions.length / 3
  positions.push(0, 0.5, 0)
  normals.push(0, 1, 0)
  for (let segment = 0; segment < radialSegments; segment += 1) {
    const next = (segment + 1) % radialSegments
    indices.push(bottomCenter, next, segment)
    indices.push(topCenter, radialSegments + segment, radialSegments + next)
  }
  return shape(positions, normals, indices)
}

export function cone(radialSegments = 8) {
  return cylinder(radialSegments, 0, 0.5)
}

export function capsule(radialSegments = 8, hemisphereRings = 3) {
  const positions = []
  const normals = []
  const indices = []
  const ringCount = hemisphereRings * 2 + 2
  for (let ring = 0; ring < ringCount; ring += 1) {
    const t = ring / (ringCount - 1)
    const latitude = -Math.PI / 2 + t * Math.PI
    const ySphere = Math.sin(latitude) * 0.25
    const y = ySphere + (latitude < 0 ? -0.25 : 0.25)
    const radius = Math.cos(latitude) * 0.25
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2
      const x = Math.cos(angle)
      const z = Math.sin(angle)
      positions.push(x * radius, y, z * radius)
      normals.push(
        x * Math.cos(latitude),
        Math.sin(latitude),
        z * Math.cos(latitude),
      )
    }
  }
  for (let ring = 0; ring < ringCount - 1; ring += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const next = (segment + 1) % radialSegments
      const a = ring * radialSegments + segment
      const b = ring * radialSegments + next
      const c = (ring + 1) * radialSegments + segment
      const d = (ring + 1) * radialSegments + next
      indices.push(a, b, d, a, d, c)
    }
  }
  return shape(positions, normals, indices)
}

export function torus(radialSegments = 6, tubularSegments = 12) {
  const positions = []
  const normals = []
  const indices = []
  const majorRadius = 0.38
  const tubeRadius = 0.12
  for (let major = 0; major < tubularSegments; major += 1) {
    const majorAngle = (major / tubularSegments) * Math.PI * 2
    for (let minor = 0; minor < radialSegments; minor += 1) {
      const minorAngle = (minor / radialSegments) * Math.PI * 2
      const ringRadius = majorRadius + Math.cos(minorAngle) * tubeRadius
      const x = Math.cos(majorAngle) * ringRadius
      const y = Math.sin(minorAngle) * tubeRadius
      const z = Math.sin(majorAngle) * ringRadius
      positions.push(x, y, z)
      normals.push(
        Math.cos(majorAngle) * Math.cos(minorAngle),
        Math.sin(minorAngle),
        Math.sin(majorAngle) * Math.cos(minorAngle),
      )
    }
  }
  for (let major = 0; major < tubularSegments; major += 1) {
    const nextMajor = (major + 1) % tubularSegments
    for (let minor = 0; minor < radialSegments; minor += 1) {
      const nextMinor = (minor + 1) % radialSegments
      const a = major * radialSegments + minor
      const b = nextMajor * radialSegments + minor
      const c = nextMajor * radialSegments + nextMinor
      const d = major * radialSegments + nextMinor
      indices.push(a, b, c, a, c, d)
    }
  }
  return shape(positions, normals, indices)
}

export function extrudedLeaf() {
  const front = [
    [0, 0.6, 0.08],
    [0.28, 0, 0.08],
    [0, -0.6, 0.08],
    [-0.28, 0, 0.08],
  ]
  const back = front.map(([x, y]) => [x, y, -0.08])
  const positions = [...front.flat(), ...back.flat()]
  const normals = [
    ...Array(4).fill([0, 0, 1]).flat(),
    ...Array(4).fill([0, 0, -1]).flat(),
  ]
  const indices = [0, 1, 2, 0, 2, 3, 6, 5, 4, 7, 6, 4]
  for (let side = 0; side < 4; side += 1) {
    const next = (side + 1) % 4
    indices.push(side, 4 + side, 4 + next, side, 4 + next, next)
  }
  return shape(positions, normals, indices)
}
