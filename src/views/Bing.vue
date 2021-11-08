<template>
</template>
<script setup>
document.body.setAttribute('bing', '')
</script>
<style>
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  -webkit-box-shadow: inset 0 0 2px rgba(0, 0, 0, 0.3);
}

::-webkit-scrollbar-thumb {
  border-radius: 5px;
  background-color: rgba(0, 0, 0, .1);
  -webkit-box-shadow: inset 0 0 2px rgba(0, 0, 0, 0.5);
}

::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}

::-webkit-scrollbar-thumb:active {
  background: #999;
}

[bing] #b_content aside, body[bing] footer {
  display: none !important;
}

[bing] #b_content {
  display: flex;
  padding: 180px 20px 30px;
}

[bing] main, [bing] #b_results {
  width: 100%;
}

[bing] #b_results > li:not(#mfa_root):not(.b_pag) {
  padding: 10px;
  margin: 10px 0;
  border-radius: 4px;
  border: 1px solid #ebeef5;
  background-color: #fff;
  overflow: hidden;
  color: #303133;
  transition: .3s;
}

body[bing] header#b_header {
  left: 0;
  right: 0;
  z-index: 1010;
  position: fixed;
  box-shadow: 0 0 16px 0;
  backdrop-filter: blur(12px);
  background-color: transparent;
  border-right: 1px solid #ececec;
  border-left: 1px solid #ececec;
}

body[bing] header#b_header, [bing] #b_content {
  margin: 0 auto;
  max-width: 1200px;
}

[bing] #b_results > li:not(#mfa_root):not(.b_pag):hover {
  background-color: transparent;
  box-shadow: rgba(0, 0, 0, .1) 0 0 12px 8px !important;
}

[bing] #b_results > li:not(#mfa_root):not(.b_pag) h2 {
  border-bottom: 1px solid #ebeef5;
  box-sizing: border-box;
  padding: 5px 0;
  font-size: 20px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

[bing] #b_results > li.b_algo:not(.b_algoBorder):nth-child(n+5) > h2 {
  content-visibility: unset;
}

[bing] #b_results > li:not(#mfa_root):not(.b_pag) h2:before {
  margin: 0;
  width: 5px;
  left: -10px;
  content: '';
  height: 20px;
  border: none;
  position: relative;
  border-radius: 2.5px;
  background-color: #2196f3;
}

[bing] #b_results > li.b_ans ul.b_vList {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-evenly;
}

[bing] #b_results > li.b_ans ul.b_vList > li {
  padding: 16px;
}

[bing] #b_results > li.b_pag ul,
[bing] #b_content #b_tween {
  display: flex;
}

[bing] #b_results > li.b_imgans {
  overflow: unset !important;
}

[bing] #b_results > li.b_pag ul {
  justify-content: center;
}

[bing] #b_content #b_tween {
  justify-content: space-between;
}
</style>
