// Canvas-based watermark overlay

let watermarkEl: HTMLDivElement | null = null

export function setWatermark(text: string) {
  removeWatermark()

  const canvas = document.createElement('canvas')
  canvas.width = 240
  canvas.height = 160

  const ctx = canvas.getContext('2d')!
  ctx.rotate((-20 * Math.PI) / 180)
  ctx.font = '14px Inter, PingFang SC, sans-serif'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 20, 100)

  const el = document.createElement('div')
  el.id = '__smart_watermark'
  el.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9998;
    background-image: url(${canvas.toDataURL('image/png')});
    background-repeat: repeat;
  `
  document.body.appendChild(el)
  watermarkEl = el
}

export function removeWatermark() {
  if (watermarkEl) {
    watermarkEl.remove()
    watermarkEl = null
  } else {
    const el = document.getElementById('__smart_watermark')
    if (el) el.remove()
  }
}