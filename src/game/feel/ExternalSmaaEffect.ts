import {
  BlendFunction,
  ClearPass,
  EdgeDetectionMaterial,
  EdgeDetectionMode,
  Effect,
  EffectAttribute,
  PredicationMode,
  ShaderPass,
  SMAAWeightsMaterial,
} from 'postprocessing'
import {
  Color,
  LinearFilter,
  NearestFilter,
  Uniform,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from 'three'

const blendFragment = `
uniform sampler2D weightMap;
varying vec2 vOffset0;
varying vec2 vOffset1;

void moveComponent(const in bvec2 condition, inout vec2 variable, const in vec2 value) {
  if (condition.x) variable.x = value.x;
  if (condition.y) variable.y = value.y;
}

void moveComponent(const in bvec4 condition, inout vec4 variable, const in vec4 value) {
  moveComponent(condition.xy, variable.xy, value.xy);
  moveComponent(condition.zw, variable.zw, value.zw);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec4 weights;
  weights.x = texture2D(weightMap, vOffset0).a;
  weights.y = texture2D(weightMap, vOffset1).g;
  weights.wz = texture2D(weightMap, uv).rb;
  vec4 color = inputColor;
  if (dot(weights, vec4(1.0)) >= 1e-5) {
    bool horizontal = max(weights.x, weights.z) > max(weights.y, weights.w);
    vec4 blendingOffset = vec4(0.0, weights.y, 0.0, weights.w);
    vec2 blendingWeight = weights.yw;
    moveComponent(bvec4(horizontal), blendingOffset, vec4(weights.x, 0.0, weights.z, 0.0));
    moveComponent(bvec2(horizontal), blendingWeight, weights.xz);
    blendingWeight /= dot(blendingWeight, vec2(1.0));
    vec4 blendingCoord = blendingOffset * vec4(texelSize, -texelSize) + uv.xyxy;
    color = blendingWeight.x * texture2D(inputBuffer, blendingCoord.xy);
    color += blendingWeight.y * texture2D(inputBuffer, blendingCoord.zw);
  }
  outputColor = color;
}`

const blendVertex = `
varying vec2 vOffset0;
varying vec2 vOffset1;

void mainSupport(const in vec2 uv) {
  vOffset0 = uv + texelSize * vec2(1.0, 0.0);
  vOffset1 = uv + texelSize * vec2(0.0, 1.0);
}`

export class ExternalSmaaEffect extends Effect {
  private readonly edges: WebGLRenderTarget
  private readonly weights: WebGLRenderTarget
  private readonly clear: ClearPass
  private readonly edgePass: ShaderPass
  private readonly weightsPass: ShaderPass
  private readonly edgeMaterial: EdgeDetectionMaterial
  private readonly weightsMaterial: SMAAWeightsMaterial

  constructor(searchTexture: Texture, areaTexture: Texture) {
    const uniforms = new Map<string, Uniform>([
      ['weightMap', new Uniform(null)],
    ])
    super('SMAAExternalLookupEffect', blendFragment, {
      vertexShader: blendVertex,
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
      uniforms,
    })

    searchTexture.magFilter = NearestFilter
    searchTexture.minFilter = NearestFilter
    searchTexture.generateMipmaps = false
    searchTexture.flipY = true
    searchTexture.needsUpdate = true
    areaTexture.magFilter = LinearFilter
    areaTexture.minFilter = LinearFilter
    areaTexture.generateMipmaps = false
    areaTexture.flipY = false
    areaTexture.needsUpdate = true

    this.edges = new WebGLRenderTarget(1, 1, { depthBuffer: false })
    this.edges.texture.name = 'SMAA.Edges'
    this.weights = this.edges.clone()
    this.weights.texture.name = 'SMAA.Weights'
    uniforms.get('weightMap')!.value = this.weights.texture
    this.clear = new ClearPass(true, false, false)
    this.clear.overrideClearColor = new Color(0)
    this.clear.overrideClearAlpha = 1
    this.edgeMaterial = new EdgeDetectionMaterial(
      undefined,
      EdgeDetectionMode.COLOR,
    )
    this.edgeMaterial.edgeDetectionThreshold = 0.1
    this.edgeMaterial.predicationMode = PredicationMode.DISABLED
    this.edgePass = new ShaderPass(this.edgeMaterial)
    this.weightsMaterial = new SMAAWeightsMaterial()
    this.weightsMaterial.searchTexture = searchTexture
    this.weightsMaterial.areaTexture = areaTexture
    this.weightsMaterial.orthogonalSearchSteps = 8
    this.weightsMaterial.diagonalDetection = false
    this.weightsMaterial.cornerDetection = 0
    this.weightsPass = new ShaderPass(this.weightsMaterial)
  }

  override update(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
  ): void {
    this.clear.render(renderer, this.edges, null)
    this.edgePass.render(renderer, inputBuffer, this.edges)
    this.weightsPass.render(renderer, this.edges, this.weights)
  }

  override setSize(width: number, height: number): void {
    this.edgeMaterial.setSize(width, height)
    this.weightsMaterial.setSize(width, height)
    this.edges.setSize(width, height)
    this.weights.setSize(width, height)
  }
}
