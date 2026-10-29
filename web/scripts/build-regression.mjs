process.env.STENCIL_LEGACY_HARNESS = '1'
const { build } = await import('vite')
await build()
