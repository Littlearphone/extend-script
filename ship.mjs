#!/usr/bin/env node
// 一条命令把用户脚本发布给油猴：构建 → 同步本机 nginx（有就同步）→ 提交产物 → 推送。
//
// 推上去之后 GitHub Pages 会重新发布 `docs/nihility.umd.user.js`，
// Tampermonkey 按脚本头部的 `@updateURL` 自己拉新版本（版本号单调递增）。
// 本地调试不走这条路——那条是 `pnpm build` + 油猴的「File → Track from disk」。
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// 本文件就在仓库根目录，所以根目录就是它所在目录
const root = import.meta.dirname
const artifact = 'docs/nihility.umd.user.js'
// publish.js 那份本机 nginx 的落点：换机器就没这个目录，所以只是"有就顺手同步"
const nginxTarget = 'D:\\UserProgram\\nginx\\html\\nihility.umd.user.js'

function run(command, args) {
  console.log(`$ ${command} ${args.join(' ')}`)
  execFileSync(command, args, { cwd: root, stdio: 'inherit' })
}

function capture(command, args) {
  return execFileSync(command, args, { cwd: root }).toString().trim()
}

// 直接跑 vite 的入口，绕开 pnpm（Windows 上 execFile 起不了 pnpm.cmd）
run(process.execPath, [path.join('node_modules', 'vite', 'bin', 'vite.js'), 'build'])

const version = /@version\s+(\S+)/.exec(fs.readFileSync(path.join(root, artifact), 'utf8'))?.[1] || ''

// 产物里编进了未提交的源码时先提醒：否则"推上去的和仓库里的"对不上
const dirtySource = capture('git', ['status', '--porcelain', '--', 'src'])
if (dirtySource) {
  console.log('\n⚠ src/ 里还有未提交的改动：这份产物包含它们，但源码还没进版本库（建议先把源码提交掉）')
}

if (fs.existsSync(path.dirname(nginxTarget))) {
  fs.copyFileSync(path.join(root, artifact), nginxTarget)
  console.log(`已同步到本机 nginx：${nginxTarget}`)
}

run('git', ['add', artifact])
const staged = capture('git', ['diff', '--cached', '--name-only'])
if (!staged) {
  console.log('\n产物没有变化，无需发布')
  process.exit(0)
}
run('git', ['commit', '-m', `重新构建用户脚本 ${version}`])
run('git', ['push'])
console.log(`\n已推送 ${version} —— 等 Tampermonkey 自己检查更新（或点它的「检查更新」）`)
