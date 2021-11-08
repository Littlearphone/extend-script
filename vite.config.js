import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// https://vitejs.dev/config/
const description = `// ==UserScript==
// @name         裁之刃-无
// @namespace    com.littelearphone.nihility
// @version      0.0.1
// @description  群体攻击技能
// @author       littelearphone
// @require      https://cdn.bootcdn.net/ajax/libs/jquery/3.6.0/jquery.min.js
// @include      *
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
const css = rawCss => `(function() {GM_addStyle(${JSON.stringify(rawCss)})})();\n`
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      name: 'nihility',
      formats: ['umd'],
      entry: 'src/main.js',
      fileName: () => 'nihility.user.js'
    },
    rollupOptions: {
      plugins: [
        {
          apply: 'build',
          enforce: 'post',
          name: 'pack-css',
          generateBundle(opts, bundle) {
            const {
              [`style.css`]: { source: rawCss },
              [`nihility.user.js`]: component
            } = bundle
            component.code = description + css(rawCss) + component.code
            // remove from final bundle
            delete bundle[`style.css`]
          }
        }
      ]
    }
  }
})
