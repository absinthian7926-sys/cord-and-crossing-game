import { useLoader } from '@react-three/fiber'
import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  Vignette,
} from '@react-three/postprocessing'
import { useEffect, useMemo } from 'react'
import { TextureLoader } from 'three'
import { FEEL } from '../../data/feel'
import type { QualityLevel } from '../../data/zone'
import { ExternalSmaaEffect } from './ExternalSmaaEffect'
import { postQualityForTier } from './postQuality'

function EnabledPostEffects({
  quality,
}: {
  readonly quality: Exclude<QualityLevel, 'Low'>
}) {
  const profile = postQualityForTier(quality)
  const [searchTexture, areaTexture] = useLoader(TextureLoader, [
    '/postprocessing/smaa-search.png',
    '/postprocessing/smaa-area.png',
  ])
  const smaa = useMemo(
    () => new ExternalSmaaEffect(searchTexture, areaTexture),
    [areaTexture, searchTexture],
  )
  useEffect(() => () => smaa.dispose(), [smaa])

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <primitive object={smaa} dispose={null} />
      {profile.effects.includes('Vignette') ? (
        <Vignette
          offset={FEEL.post.vignette.offset}
          darkness={FEEL.post.vignette.darkness}
        />
      ) : null}
      {profile.effects.includes('ColorGrade') ? (
        <>
          <BrightnessContrast
            brightness={FEEL.post.colorGrade.brightness}
            contrast={FEEL.post.colorGrade.contrast}
          />
          <HueSaturation saturation={FEEL.post.colorGrade.saturation} />
        </>
      ) : null}
      {profile.bloom ? (
        <Bloom
          intensity={profile.bloom.intensity}
          luminanceThreshold={profile.bloom.luminanceThreshold}
          mipmapBlur={profile.bloom.mipmapBlur}
        />
      ) : null}
    </EffectComposer>
  )
}

export function PostEffects({ quality }: { readonly quality: QualityLevel }) {
  if (quality === 'Low') return null
  return <EnabledPostEffects quality={quality} />
}
