import { useEffect, useState } from 'react'
import { api, type ImageInfo } from '../api'
import { decodeBytes } from './project'
import { useEditor } from './session'
export default function SourceInformation({ id, resolution }: { id: string; resolution: number }) {
  const asset = useEditor(s => s.doc?.raw.images?.[id]), [info, setInfo] = useState<ImageInfo>()
  useEffect(() => {
    let alive = true
    void (async () => {
      let runtimeId = id
      if (typeof asset?.base64 === 'string') runtimeId = (await api.loadImage(decodeBytes(asset.base64), asset.name)).id
      const result = await api.imageInfo(runtimeId, resolution); if (alive) setInfo(result)
    })().catch(() => { if (alive) setInfo(undefined) })
    return () => { alive = false }
  }, [id, resolution, asset?.base64])
  return info ? <p className="file-information">{info.format.toUpperCase()} · {info.width} × {info.height} original pixels · {info.working.join(' × ')} working pixels</p> : null
}
