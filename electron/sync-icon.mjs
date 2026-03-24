import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FRONTEND_ROOT = path.resolve(__dirname, '..')
const SOURCE_SVG_PATH = path.resolve(FRONTEND_ROOT, 'src', 'assets', 'img', 'icon.svg')
const BUILD_RESOURCES_ROOT = path.resolve(FRONTEND_ROOT, 'build')
const BUILD_SVG_PATH = path.resolve(BUILD_RESOURCES_ROOT, 'icon.svg')
const CACHE_ROOT = path.resolve(__dirname, '.icon-cache')
const PREVIEW_ROOT = path.resolve(CACHE_ROOT, 'preview')
const ICONSET_ROOT = path.resolve(CACHE_ROOT, 'DataFactory.iconset')
const OUTPUT_ICNS_PATH = path.resolve(BUILD_RESOURCES_ROOT, 'icon.icns')
const ELECTRON_ICNS_PATH = path.resolve(
  FRONTEND_ROOT,
  'node_modules',
  'electron',
  'dist',
  'Electron.app',
  'Contents',
  'Resources',
  'electron.icns'
)

const ICONSET_FILES = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png']
]

const run = (command, args) => {
  execFileSync(command, args, { stdio: 'pipe' })
}

const ensureEmptyDir = (targetPath) => {
  rmSync(targetPath, { recursive: true, force: true })
  mkdirSync(targetPath, { recursive: true })
}

if (!existsSync(SOURCE_SVG_PATH)) {
  throw new Error(`Source icon not found: ${SOURCE_SVG_PATH}`)
}

mkdirSync(BUILD_RESOURCES_ROOT, { recursive: true })
cpSync(SOURCE_SVG_PATH, BUILD_SVG_PATH)
ensureEmptyDir(PREVIEW_ROOT)
ensureEmptyDir(ICONSET_ROOT)

run('qlmanage', ['-t', '-s', '1024', '-o', PREVIEW_ROOT, BUILD_SVG_PATH])

const previewPngName = readdirSync(PREVIEW_ROOT).find((name) => name.toLowerCase().endsWith('.png'))
if (!previewPngName) {
  throw new Error(`Failed to render PNG preview from SVG: ${SOURCE_SVG_PATH}`)
}

const previewPngPath = path.resolve(PREVIEW_ROOT, previewPngName)

ICONSET_FILES.forEach(([size, fileName]) => {
  run('sips', ['-z', String(size), String(size), previewPngPath, '--out', path.resolve(ICONSET_ROOT, fileName)])
})

rmSync(OUTPUT_ICNS_PATH, { force: true })
run('iconutil', ['-c', 'icns', ICONSET_ROOT, '-o', OUTPUT_ICNS_PATH])

if (!existsSync(OUTPUT_ICNS_PATH)) {
  throw new Error(`Failed to generate icns file: ${OUTPUT_ICNS_PATH}`)
}

if (existsSync(ELECTRON_ICNS_PATH)) {
  cpSync(OUTPUT_ICNS_PATH, ELECTRON_ICNS_PATH)
  console.log(`Synced Electron app icon: ${ELECTRON_ICNS_PATH}`)
} else {
  console.warn(`Electron runtime icon not found, generated icns only: ${OUTPUT_ICNS_PATH}`)
}
