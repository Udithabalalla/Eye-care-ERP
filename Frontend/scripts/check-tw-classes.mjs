// Finds Tailwind classes in src/ that compile to no CSS.
//
// The shadcn components are generated for Tailwind v4, and this app runs Tailwind v3.
// v4-only syntax (h-(--x), **:, --spacing(), unmapped data-* variants) is silently
// dropped by v3, so a component can look fine in code review and still render
// unstyled. This compiles every candidate class with the real tailwind.config.js and
// lists the ones that produced nothing.
//
// Usage: npm run check:tw            (all of src/)
//        npm run check:tw -- src/components/ui
// Exit code 1 when anything is found. Known false positives go in IGNORE below.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const postcss = require('postcss')
const tailwind = require('tailwindcss')
const escapeClassName = require('tailwindcss/lib/util/escapeClassName').default

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Tailwind's own loader (jiti): a plain import() can't resolve 'tailwindcss/plugin'
const config = require('tailwindcss/loadConfig')(path.join(root, 'tailwind.config.js'))

// Strings that look like classes but aren't (time formats, labels, CSS-in-JS for print)
const IGNORE = [
  /^[A-Za-z]+:$/, // "Terms:", "Next:", "font-size:"
  /^-?[a-z-]+:$/, // CSS property names in print templates
  /^(hh|HH):mm/,
  /^T\d\d:/,
  /^(https?|mailto|tel|data|file|auth):/,
  /\.replace\(/,
  /^[a-z-]+:\d/, // "margin:8px" in print templates
  /^(group|peer)\/[\w-]+$/, // named group/peer markers carry no CSS of their own
  /^[A-Za-z]+!$/, // "updated!" in a toast message
]

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['src']
const files = []
const walk = (p) => {
  const abs = path.resolve(root, p)
  if (fs.statSync(abs).isDirectory()) {
    for (const entry of fs.readdirSync(abs)) walk(path.join(p, entry))
  } else if (/\.(tsx?|jsx?)$/.test(p)) {
    files.push(abs)
  }
}
targets.forEach(walk)

// Candidates: tokens inside string literals that carry a variant (x:y), an opacity
// modifier (x/50) or v4-only syntax (x-(--y), x!). Plain utilities are left alone; a typo
// like "flx" is not what this check is for.
const classLike = /^!?-?[a-z@*[][a-z0-9:\-[\]/.=_%()&>*,#!@+'"$^~|]*$/i
// Template literals can hold quoted sub-strings: `${a ? 'bg-muted/30' : ''}`. Strip a
// dangling quote, but keep balanced ones that belong to the class: [class*='size-']
const unquote = (token) => {
  for (const q of ["'", '"']) {
    if ((token.split(q).length - 1) % 2 === 0) continue
    if (token.startsWith(q)) token = token.slice(1)
    else if (token.endsWith(q)) token = token.slice(0, -1)
  }
  return token
}
const strings = /"[^"\n]*"|'[^'\n]*'|`[^`]*`/g
const found = new Map()
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  for (const literal of source.match(strings) ?? []) {
    // Split on whitespace and ${ } only: '$' alone belongs to [data-slot$=-item]
    for (const raw of literal.slice(1, -1).split(/\s+|\$\{|\}/)) {
      const token = unquote(raw)
      if (!classLike.test(token)) continue
      // v4-only: trailing important (animate-none!, v3 wants !animate-none) and spacing
      // steps v3 doesn't have (pl-7.5, size-4.5)
      const v4Only = /-\(--|[\w\])]!$/.test(token) || /^-?[a-z]+(-[a-z]+)*-\d+\.\d+$/.test(token)
      if (!/[:/]/.test(token) && !v4Only) continue
      // Module paths ('react-dom/client') rather than opacity modifiers ('bg-primary/10')
      if (!token.includes(':') && !/\/(\d|\[)/.test(token) && !v4Only) continue
      if (IGNORE.some((re) => re.test(token))) continue
      const rel = path.relative(root, file).split(path.sep).join('/')
      if (!found.has(token)) found.set(token, new Set())
      found.get(token).add(rel)
    }
  }
}

const css = (
  await postcss([tailwind({ ...config, content: [{ raw: [...found.keys()].join(' ') }] })]).process(
    '@tailwind base; @tailwind components; @tailwind utilities;',
    { from: undefined },
  )
).css

const missing = [...found].filter(([token]) => !css.includes('.' + escapeClassName(token)))
for (const [token, where] of missing.sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`${token}\n    ${[...where].join(', ')}`)
}
console.log(`\n${missing.length} class(es) compile to no CSS (${found.size} checked in ${files.length} files).`)
process.exit(missing.length ? 1 : 0)
