<template>
  <div class="nihility-download-mask" @click.self="handleClose">
    <div class="nihility-download-dialog">
      <header class="download-header">
        <div class="download-title">
          <span class="download-title-text">{{ listTitle || '视频下载' }}</span>
          <span class="download-title-sub" v-if="!loading && !loadError">共 {{ rows.length }} 个视频</span>
        </div>
        <button class="download-close" title="关闭" @click="handleClose">×</button>
      </header>

      <div class="download-loading display-flex-center" v-if="loading">正在读取视频列表…</div>
      <div class="download-loading download-error display-flex-center" v-else-if="loadError">{{ loadError }}</div>

      <template v-else>
        <div class="download-toolbar">
          <label class="download-select-all">
            <input type="checkbox" :checked="allChecked" @change="toggleAll($event.target.checked)"/>
            <span>全选</span>
          </label>
          <span class="download-selected">已选 {{ selectedCount }} 个</span>
          <span class="download-hint">
            每个视频一个子目录：<code>_1.m4s</code> 视频轨、<code>_2.m4s</code> 音频轨，交给 oho 自动合并
          </span>
        </div>

        <div class="download-table-wrap">
          <table class="download-table">
            <colgroup>
              <col style="width: 34px"/>
              <col style="width: 46px"/>
              <col/>
              <col style="width: 62px"/>
              <col style="width: 220px"/>
              <col style="width: 170px"/>
              <col style="width: 68px"/>
            </colgroup>
            <thead>
            <tr>
              <th></th>
              <th>#</th>
              <th>标题</th>
              <th>时长</th>
              <th>文件名前缀</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="(row, index) in rows" :key="row.item.key" :class="`is-${row.phase}`">
              <td>
                <input type="checkbox" v-model="row.checked"/>
              </td>
              <td class="cell-index">{{ index + 1 }}</td>
              <td class="cell-title" :title="row.item.title">
                <span class="title-text">{{ row.item.title }}</span>
                <span class="title-quality" v-if="row.quality">{{ row.quality }}</span>
              </td>
              <td class="cell-duration">{{ formatDuration(row.item.duration) }}</td>
              <td>
                <input class="download-prefix" type="text" v-model="row.prefix" :disabled="row.phase === 'running'"/>
              </td>
              <td class="cell-status" :title="row.message">
                <span v-if="row.phase === 'running'" class="status-running"></span>
                <span :class="`status-text is-${row.phase}`">{{ row.message || '待下载' }}</span>
              </td>
              <td>
                <button class="download-row-button" :disabled="running || row.phase === 'running'"
                        @click="downloadRows([row])">
                  下载
                </button>
              </td>
            </tr>
            </tbody>
          </table>
        </div>

        <footer class="download-footer">
          <span class="download-notice" :class="{ 'is-warn': !!notice }">{{ notice || defaultNotice }}</span>
          <div class="download-actions">
            <button class="download-button" :disabled="!selectedCount || running" @click="downloadSelected">
              {{ running ? `下载中… (${runDone}/${runTotal})` : `下载选中 (${selectedCount})` }}
            </button>
            <button class="download-button is-plain" v-if="running" @click="stopRequested = true">停止</button>
            <button class="download-button is-plain" v-else @click="handleClose">关闭</button>
          </div>
        </footer>
      </template>
    </div>
  </div>
</template>
<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { collectVideoItems, formatDuration, resolveStreams, safeFileName } from '../utils/bilibili.js'
import {
  existsWithContent,
  formatPercent,
  getCachedDirectory,
  pickDirectory,
  saveStreamAsDownload,
  supportsDirectoryPicker,
  writeStreamToFile,
} from '../utils/bilibili-download.js'

const emit = defineEmits(['close'])

const rows = ref([])
const listTitle = ref('')
const loading = ref(true)
const loadError = ref('')
const notice = ref('')
const running = ref(false)
const runDone = ref(0)
const runTotal = ref(0)
const stopRequested = ref(false)

const selectedCount = computed(() => rows.value.filter(row => row.checked).length)
const allChecked = computed(() => rows.value.length > 0 && rows.value.every(row => row.checked))
const defaultNotice = computed(() => supportsDirectoryPicker()
  ? '首次下载会弹出目录选择，之后本页复用同一个目录'
  : '当前浏览器不支持选择目录，文件会直接进下载目录（两个文件请手动放到同一个文件夹）')

function toggleAll(checked) {
  rows.value.forEach(row => row.checked = checked)
}

function handleClose() {
  emit('close')
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const result = await collectVideoItems()
    listTitle.value = result.title
    rows.value = result.items.map(item => ({
      item,
      checked: false,
      prefix: item.prefix,
      quality: '',
      phase: 'idle',
      message: '',
    }))
    // 只有一条时直接勾上，省得再点一次
    if (rows.value.length === 1) rows.value[0].checked = true
  } catch (error) {
    loadError.value = error.message || String(error)
    logger.warn('读取 B 站视频列表失败', error)
  } finally {
    loading.value = false
  }
}

function validate(targets) {
  const prefixes = targets.map(row => safeFileName(row.prefix))
  const duplicated = prefixes.find((prefix, index) => prefixes.indexOf(prefix) !== index)
  if (duplicated) return `前缀重复：${duplicated}，同一个目录里会互相覆盖`
  if (prefixes.some(prefix => !prefix)) return '文件名前缀不能为空'
  return ''
}

async function downloadSelected() {
  const targets = rows.value.filter(row => row.checked)
  await downloadRows(targets)
}

async function downloadRows(targets) {
  if (running.value) return
  const list = (targets || []).filter(row => row && row.phase !== 'running')
  if (!list.length) return
  const invalid = validate(list)
  if (invalid) {
    notice.value = invalid
    return
  }
  notice.value = ''
  // 目录选择必须发生在这次点击的同步路径里，否则浏览器不给授权。
  let directory = getCachedDirectory()
  if (!directory && supportsDirectoryPicker()) {
    try {
      directory = await pickDirectory()
    } catch (error) {
      notice.value = '没有选择目录，已取消下载'
      return
    }
  }
  running.value = true
  runDone.value = 0
  runTotal.value = list.length
  stopRequested.value = false
  try {
    for (const row of list) {
      if (stopRequested.value) {
        notice.value = `已停止，还剩 ${runTotal.value - runDone.value} 个没下`
        break
      }
      await downloadRow(row, directory)
      runDone.value++
    }
  } finally {
    running.value = false
  }
}

async function downloadRow(row, directory) {
  row.phase = 'running'
  row.message = '取流地址…'
  try {
    const streams = await resolveStreams(row.item)
    row.quality = streams.quality
    const prefix = safeFileName(row.prefix)
    // 一个视频一个子目录：oho 找"另一条轨"时只看同一个目录、且候选最多 10 个，
    // 平铺一整个合集会让第 6 集往后配不上对。
    const folder = directory ? await directory.getDirectoryHandle(prefix, { create: true }) : null
    const skipped = []
    if (streams.mode === 'progressive') {
      // 只有整段流：它本身已经音视频齐全，存成 mp4，没什么可合并的。
      skipped.push(await saveTrack(row, folder, `${prefix}.mp4`, streams.progressive.urls, '整段'))
      row.message = `完成 · ${streams.quality}`
    } else {
      skipped.push(await saveTrack(row, folder, `${prefix}_1.m4s`, streams.video.urls, '视频'))
      if (streams.audio) {
        skipped.push(await saveTrack(row, folder, `${prefix}_2.m4s`, streams.audio.urls, '音频'))
        row.message = `完成 · ${streams.quality}`
      } else {
        row.message = `完成 · ${streams.quality}（没有独立音轨，无需合并）`
      }
    }
    if (skipped.some(Boolean)) row.message += '（已存在，跳过）'
    row.phase = 'done'
  } catch (error) {
    row.phase = 'error'
    row.message = error.message || String(error)
    logger.warn(`下载失败：${row.item.title}`, error)
  }
}

async function saveTrack(row, folder, filename, urls, label) {
  const report = progress => {
    row.message = `${label} ${formatPercent(progress.received, progress.total)}`
  }
  row.message = `${label} 下载中…`
  if (!folder) {
    await saveStreamAsDownload(filename, urls, report)
    return false
  }
  if (await existsWithContent(folder, filename)) {
    row.message = `${label} 已存在，跳过`
    return true
  }
  await writeStreamToFile(folder, filename, urls, report)
  return false
}

function handleKeydown(event) {
  if (event.key === 'Escape') handleClose()
}

onMounted(() => {
  load()
  window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>
<style lang="scss" scoped>
.nihility-download-mask {
  inset: 0;
  display: flex;
  z-index: 200;
  position: fixed;
  pointer-events: all;
  align-items: center;
  justify-content: center;
  background-color: #00000080;
  backdrop-filter: blur(4px);
}

.nihility-download-dialog {
  width: min(1100px, 92vw);
  display: flex;
  color: #f0f0f0;
  overflow: hidden;
  max-height: 84vh;
  font-size: 13px;
  border-radius: 12px;
  flex-direction: column;
  background-color: #16161af2;
  box-shadow: 0 12px 48px #000000aa;

  .download-header {
    display: flex;
    flex: none;
    padding: .8em 1em;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #ffffff1a;

    .download-title {
      display: flex;
      gap: .6em;
      align-items: baseline;
      min-width: 0;

      .download-title-text {
        font-size: 15px;
        font-weight: bold;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .download-title-sub {
        color: #ffffff80;
      }
    }

    .download-close {
      border: 0;
      color: #fff9;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      padding: 0 .3em;
      background: none;

      &:hover {
        color: #fff;
      }
    }
  }

  .download-loading {
    flex: 1;
    padding: 3em;
    color: #fff9;

    &.download-error {
      color: #ff9a9a;
    }
  }

  .download-toolbar {
    gap: .8em;
    display: flex;
    flex: none;
    padding: .6em 1em;
    align-items: center;
    border-bottom: 1px solid #ffffff1a;

    .download-select-all {
      gap: .3em;
      display: flex;
      cursor: pointer;
      align-items: center;
    }

    .download-selected {
      color: #b5dcff;
    }

    .download-hint {
      color: #ffffff66;
      margin-left: auto;

      code {
        padding: 0 .3em;
        color: #b5dcff;
        border-radius: 3px;
        background-color: #ffffff14;
      }
    }
  }

  .download-table-wrap {
    flex: 1;
    overflow: auto;
  }

  .download-table {
    width: 100%;
    border-spacing: 0;
    table-layout: fixed;

    th, td {
      padding: .4em .5em;
      text-align: left;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      border-bottom: 1px solid #ffffff0f;
    }

    thead th {
      top: 0;
      z-index: 1;
      color: #ffffff99;
      position: sticky;
      font-weight: normal;
      background-color: #1e1e24;
    }

    tbody tr:hover {
      background-color: #ffffff0a;
    }

    tr.is-done .cell-status {
      color: #8ee08e;
    }

    tr.is-error .cell-status {
      color: #ff9a9a;
    }

    .cell-index,
    .cell-duration {
      color: #ffffff80;
    }

    .cell-title .title-text {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      display: inline-block;
      max-width: calc(100% - 60px);
      vertical-align: bottom;
    }

    .cell-title .title-quality {
      color: #ffd479;
      margin-left: .4em;
      padding: 0 .3em;
      border-radius: 3px;
      background-color: #ffd47922;
    }

    .download-prefix {
      width: 100%;
      color: #f0f0f0;
      padding: .25em .4em;
      border-radius: 4px;
      border: 1px solid #ffffff33;
      background-color: #ffffff0f;

      &:focus {
        outline: none;
        border-color: #409eff;
      }
    }

    .cell-status {
      color: #ffffff99;

      .status-running {
        width: .6em;
        height: .6em;
        margin-right: .4em;
        border-radius: 50%;
        display: inline-block;
        background-color: #409eff;
        animation: download-pulse 1s ease-in-out infinite;
      }
    }

    .download-row-button {
      cursor: pointer;
      color: #b5dcff;
      padding: .25em .6em;
      border-radius: 4px;
      border: 1px solid #409eff66;
      background-color: #409eff1f;

      &:hover:not(:disabled) {
        background-color: #409eff3d;
      }

      &:disabled {
        cursor: not-allowed;
        opacity: .5;
      }
    }
  }

  .download-footer {
    gap: 1em;
    display: flex;
    flex: none;
    padding: .7em 1em;
    align-items: center;
    border-top: 1px solid #ffffff1a;

    .download-notice {
      color: #ffffff80;

      &.is-warn {
        color: #ffb36b;
      }
    }

    .download-actions {
      gap: .6em;
      display: flex;
      margin-left: auto;
    }

    .download-button {
      cursor: pointer;
      color: #fff;
      padding: .45em 1.1em;
      border-radius: 6px;
      border: 1px solid transparent;
      background-color: #409eff;

      &:hover:not(:disabled) {
        background-color: #66b1ff;
      }

      &:disabled {
        cursor: not-allowed;
        opacity: .5;
      }

      &.is-plain {
        color: #fff9;
        background-color: #ffffff14;

        &:hover {
          color: #fff;
          background-color: #ffffff26;
        }
      }
    }
  }
}

@keyframes download-pulse {
  0%, 100% {
    opacity: .3;
  }
  50% {
    opacity: 1;
  }
}
</style>
