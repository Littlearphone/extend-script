import moment from 'moment'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// https://vitejs.dev/config/

// 更新源只有一个：GitHub Pages（`pnpm ship` 推上去之后油猴自己拉）。
// 本地调试**不需要**第二条 URL：油猴的「File → Track from disk」直接盯磁盘上这份产物即可
// （见 CLAUDE.md「脚本怎么到油猴手里」），所以这里没有第二套地址、端口或输出目录。
const UPDATE_URL = 'https://littlearphone.github.io/extend-script/nihility.umd.user.js'

const monthStart = moment().startOf('month').toDate()
monthStart.setHours(0, 0, 0, 0)

// 版本号**必须每次产出时算**（不能写在 config 顶层）：`vite build --watch` 只解析一次配置，
// 顶层算的话每轮重建都是同一个版本号。形如 2026.9.489491.250（年.月索引.月内秒.毫秒）。
const buildVersion = () => {
  const now = new Date()
  const elapsed = now.getTime() - monthStart.getTime()
  return `${now.getFullYear()}.${now.getMonth()}.${Math.floor(elapsed / 1000)}.${elapsed % 1000}`
}
const description = (version) => `// ==UserScript==
// @name         裁之刃-无
// @namespace    com.littelearphone.nihility
// @version      ${version}
// @description  群体攻击技能
// @author       littelearphone
// @downloadURL  ${UPDATE_URL}
// @updateURL    ${UPDATE_URL}
// @require      https://code.jquery.com/jquery-3.7.1.slim.min.js
// @include      /https?://t.bilibili.com/.*/
// @include      /https?://juejin.cn/post/.*/
// @include      /https?://www.douyin.com/.*/
// @include      /https?://www.baidu.com/s[?].*/
// @include      /https?://www.jianshu.com/p/.*/
// @include      /https?://tieba.baidu.com/p/.*/
// @include      /https?://www.jb51.net/.*.html?/
// @include      /https?://zhuanlan.zhihu.com/p/.*/
// @include      /https?://blog.51cto.com/[^/]+/.*/
// @include      /https?://www.zhihu.com/question/.*/
// @include      /https?://baijiahao.baidu.com/s[?].*/
// @include      /https?://(live|www).bilibili.com/.*/
// @include      /https?://www.google.com/search[?].*/
// @include      /https?://www.bilibili.com/video/BV.*/
// @include      /https?://(cn|www).bing.com/search[?].*/
// @include      /https?://www.51cto.com/article/.+.html/
// @include      /https?://stackoverflow.com/questions/.*/
// @include      /https?://developer.aliyun.com/article/.*/
// @include      /https?://www.360doc.com/content/.*.shtml/
// @include      /https?://www.douyu.com/directory/myFollow/
// @include      /https?://jingyan.baidu.com/article/.*.html/
// @include      /https?://dba.stackexchange.com/questions/.*/
// @include      /https?://blog.csdn.net/[^/]+/article/details/.*/
// @include      /https?://www.douyu.com/([0-9]+|topic/.*[?]rid=[0-9]+)/
// @include      /https?://cloud.tencent.com.cn/developer/(information|article)/.*/
// @include      /https?://developer.baidu.com/article/detail([.]html[?]id=.*|s/.*)/
// @include      /https?://([a-z]+[.])?v2ex[.]com/.*/
// @grant        GM.setValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM_getValue
// @grant        GM.addStyle
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// 面板菜单（点油猴图标弹出的那个面板）：按页面注册不同条目，见 src/utils/script-menu.js
// @grant        GM_registerMenuCommand
// @grant        GM.registerMenuCommand
// @run-at       document-start
// ==/UserScript==
`
const inlineCss = rawCss => `(function () {
  function insertCommonStyle() {
    try {
      if (document.getElementById('nihility.common.style')) {
        return setTimeout(insertCommonStyle, 100)
      }
      // document.head 在 document-start 阶段可能还不存在
      const head = document.head || document.documentElement
      if (!head) {
        return setTimeout(insertCommonStyle, 50)
      }
      const element = document.createElement('style')
      element.id = 'nihility.common.style'
      // 必须用 textContent：有些站（如 V2EX）开了 Trusted Types，
      // 给 innerHTML 赋字符串会直接抛异常，样式就全丢了
      element.textContent = ${JSON.stringify(rawCss)}
      head.appendChild(element)
    } catch (error) {
      // 页面还没就绪，下一轮再试
    }
    return setTimeout(insertCommonStyle, 100)
  }
  return setTimeout(insertCommonStyle, 100)
})();\n`
export default defineConfig(({ mode }) => {
  return {
    plugins: [vue()],
    define: {
      // 只有 dev 才是 development：构建（含 --watch）都按生产构建，
      // 否则 Vue 会带上开发期告警与未压缩的响应式实现。
      'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
    },
    css: {
      preprocessorOptions: {
        scss: { api: 'modern-compiler' }
      }
    },
    build: {
      outDir: 'docs',
      lib: {
        name: 'nihility',
        formats: ['umd'],
        entry: 'src/main.js',
        fileName: () => 'nihility.umd.user.js'
      },
      rollupOptions: {
        plugins: [
          {
            apply: 'build',
            enforce: 'post',
            name: 'pack-css',
            generateBundle(opts, bundle) {
              // console.log(opts, bundle)
              const {
                [`nihility-script.css`]: { source: rawCss },
                [`nihility.umd.user.js`]: component
              } = bundle
              component.code = description(buildVersion()) + inlineCss(rawCss) + component.code
              // remove from final bundle
              delete bundle[`nihility-script.css`]
            }
          }
        ]
      }
    },
    server: {
      port: 4567
    }
  }
})
