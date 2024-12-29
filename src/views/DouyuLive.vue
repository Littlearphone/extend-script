<template>

</template>
<script setup>
import { onMounted, reactive, ref, watch } from 'vue'

const CONFIG_KEY = 'douyu-hack-config'

const config = reactive(JSON.parse(GM_getValue(CONFIG_KEY, '{}')))
const fullWebScreen = ref(config.fullWebScreen || false)
watch(fullWebScreen, value => {
  config.fullWebScreen = value
  GM_setValue(CONFIG_KEY, JSON.stringify(Object.assign({}, config)))
})

function detectVideo(player) {
  const video = document.querySelector('.layout-Player-video')
  if (!video || !document.querySelector('#js-player-video')) {
    return requestAnimationFrame(() => detectVideo(player))
  }
  if (!video.querySelector('.title-toggle-button')) {
    const i = document.createElement('i')
    i.onclick = () => player.classList.toggle('toggle-layout-fold')
    i.classList.add('title-toggle-button')
    video.appendChild(i)
  }
  if (!video.querySelector('.toolbar-toggle-button')) {
    const i = document.createElement('i')
    i.onclick = () => player.classList.toggle('toggle-layout-fold')
    i.classList.add('toolbar-toggle-button')
    video.appendChild(i)
  }
}

function detectPlayer() {
  const player = document.querySelector('.layout-Player')
  if (!player) {
    return requestAnimationFrame(detectPlayer)
  }
  if (!config.hasOwnProperty('fullWebScreen') || fullWebScreen.value) {
    player.classList.add('toggle-layout-fold')
  } else {
    player.classList.remove('toggle-layout-fold')
  }
  requestAnimationFrame(() => detectVideo(player))
}

onMounted(() => {
  requestAnimationFrame(detectPlayer)
})
</script>
<style lang="scss">
html:has([www-douyu-com]) {
  overflow: hidden !important;

  body[www-douyu-com] {
    &, #js-room-activity,
    .layout-Player .layout-Player-aside,
    .layout-Player [class*='recommendApp-'],
    .layout-Player [class*='recommendAD-'] {
      overflow: hidden !important;
    }

    #js-room-activity,
    .RechangeJulyPopups,
    [class*='ActAnnual'] {
      display: none !important;
    }

    .layout-Player {
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      z-index: 999999 !important;
      position: fixed !important;

      .layout-Player-main {
        margin: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }

      .layout-Player-video {
        width: 100%;
        overflow: visible;
        padding: 0 !important;
        height: calc(100% - 200px);

        video {
          width: 100% !important;
          height: 100% !important;
        }

        .title-toggle-button,
        .toolbar-toggle-button {
          left: 0;
          right: 0;
          width: 32px;
          height: 16px;
          z-index: 999;
          border: none;
          display: flex;
          margin: 0 auto;
          cursor: pointer;
          position: absolute;
          border-radius: 5px;
          align-items: center;
          background: white;
          justify-content: center;
          box-shadow: 0 0 10px grey;

          &::before,
          &::before {
            border-width: 8px;
            border-style: solid;
            border-color: transparent;
            background: transparent;
            display: inline-flex;
            align-self: center;
            content: ' ';
          }
        }

        .title-toggle-button {
          bottom: -8px;

          &::before {
            border-top-color: gray;
            border-bottom-width: 0;
          }
        }

        .toolbar-toggle-button {
          top: -8px;

          &::before {
            border-bottom-color: gray;
            border-top-width: 0;
          }
        }
      }

      &.toggle-layout-fold {
        .layout-Player-video {
          height: 100% !important;

          .title-toggle-button {
            bottom: 0;
            backdrop-filter: blur(10px);
            background-color: transparent;

            &::before {
              border-top-width: 0;
              border-top-color: transparent;
              border-bottom-width: 8px;
              border-bottom-color: gray;
            }
          }

          .toolbar-toggle-button {
            top: 0;
            backdrop-filter: blur(10px);
            background-color: transparent;

            &::before {
              border-bottom-width: 0;
              border-bottom-color: transparent;
              border-top-width: 8px;
              border-top-color: gray;
            }
          }
        }

        .layout-Player-title,
        .layout-Player-toolbar,
        .layout-Player-title *:not(.title-toggle-button),
        .layout-Player-toolbar *:not(.toolbar-toggle-button) {
          height: 0 !important;
          padding: 0 !important;
          min-height: 0 !important;
        }
      }

      .Title-category > * {
        max-width: unset;
      }

      .layout-Player-title,
      .layout-Player-toolbar {
        &, & * {
          transition: all 0.3s;
        }
      }

      .ZoomTip,
      .Title-ad,
      .TitleShare,
      .PhoneWatch,
      .PcDiversion,
      .RedEnvelopAd,
      .FirstPurchase,
      .DanmuEffectDom,
      .RoomVipSysTitle,
      .AnchorPocketTips,
      .Title-sharkWeight,
      [class*='adsRoot_'],
      .TitleSuperFansWrap,
      .layout-Player-aside,
      .LuckyStarTitle-wrap,
      .ToolbarActivityArea,
      .FirstRechargePayPanel,
      [class*='recommendAD-'],
      [class*='broadcastDiv-'],
      [class*='recommendApp-'],
      .Title-anchorFriendWrapper,
      .PlayerToolbar-ContentCell,
      .Title-row:has(.ClientJump) {
        display: none !important;
      }
    }
  }
}

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
</style>
