import moment from 'moment'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// https://vitejs.dev/config/
const monthStart = moment().startOf('month').toDate()
monthStart.setHours(0, 0, 0, 0)
const date = new Date()
const description = `// ==UserScript==
// @name         裁之刃-无
// @namespace    com.littelearphone.nihility
// @version      ${date.getFullYear()}.${date.getMonth()}.${((date.getTime() - monthStart.getTime()) / 1000).toFixed(0)}
// @description  群体攻击技能
// @author       littelearphone
// @downloadURL  http://localhost/nihility.umd.user.js
// @updateURL    http://localhost/nihility.umd.user.js
// @require      https://code.jquery.com/jquery-3.7.1.slim.min.js
// @include      /https?://t.bilibili.com/.*/
// @include      /https?://juejin.cn/post/.*/
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
// @include      /https?://jingyan.baidu.com/article/.*.html/
// @include      /https?://dba.stackexchange.com/questions/.*/
// @include      /https?://blog.csdn.net/[^/]+/article/details/.*/
// @include      /https?://www.douyu.com/([0-9]+|topic/.*[?]rid=[0-9]+)/
// @include      /https?://cloud.tencent.com.cn/developer/(information|article)/.*/
// @include      /https?://developer.baidu.com/article/detail([.]html[?]id=.*|s/.*)/
// @grant        GM.setValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM_getValue
// @grant        GM.addStyle
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==
`
const inlineCss = rawCss => `(function () {
  function insertCommonStyle() {
    const id = 'nihility.common.style'
    if (document.getElementById(id)) {
      return setTimeout(insertCommonStyle, 100)
    }
    const styleElement = (function () {
      const element = document.createElement('style')
      document.head.appendChild(element)
      element.id = id
      return element
    })()
    styleElement.innerHTML = ${JSON.stringify(rawCss)}
    return setTimeout(insertCommonStyle, 100)
  }
  return setTimeout(insertCommonStyle, 100)
})();\n`
export default defineConfig(({ mode }) => {
  return {
    plugins: [vue()],
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    css: {
      preprocessorOptions: {
        scss: { api: 'modern-compiler' }
      }
    },
    build: {
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
              component.code = description + inlineCss(rawCss) + component.code
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
