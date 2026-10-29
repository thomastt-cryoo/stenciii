export interface Crop { crop_left: number; crop_top: number; crop_right: number; crop_bottom: number }
export function cropPixels(p: Partial<Crop>, width: number, height: number) {
  return { left: Math.round(Number(p.crop_left ?? 0) * width / 100), top: Math.round(Number(p.crop_top ?? 0) * height / 100), right: width - Math.round(Number(p.crop_right ?? 0) * width / 100), bottom: height - Math.round(Number(p.crop_bottom ?? 0) * height / 100) }
}
export function cropAt(p: Crop, handle: string, x: number, y: number, width: number, height: number): Crop {
  const b = cropPixels(p, width, height), gapX = Math.max(2, Math.ceil(width * .055)), gapY = Math.max(2, Math.ceil(height * .055))
  if (handle.includes('left')) b.left = Math.max(0, Math.min(Math.round(x), b.right - gapX, Math.floor(width * .9)))
  if (handle.includes('right')) b.right = Math.min(width, Math.max(Math.round(x), b.left + gapX, Math.ceil(width * .1)))
  if (handle.includes('top')) b.top = Math.max(0, Math.min(Math.round(y), b.bottom - gapY, Math.floor(height * .9)))
  if (handle.includes('bottom')) b.bottom = Math.min(height, Math.max(Math.round(y), b.top + gapY, Math.ceil(height * .1)))
  return { crop_left: b.left / width * 100, crop_top: b.top / height * 100, crop_right: (width - b.right) / width * 100, crop_bottom: (height - b.bottom) / height * 100 }
}
