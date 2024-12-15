<template>
  <div class="nihility-switcher display-flex-center" :style="switcherStyle">
    <div class="switcher-label">{{ label || '' }}</div>
    <input type="checkbox" aria-hidden="true" :checked="model"/>
    <div :class="trackClasses" @click="changeValue">
      <div class="switcher-core"></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import {computed} from 'vue'

const props = withDefaults(defineProps<{ label?: string, labelColor?: string }>(), {labelColor: '#fff'})
const model = defineModel({type: Boolean, default: false})
const trackClasses = computed(() => {
  if (model.value) {
    return ['switcher-track', 'is-active']
  }
  return ['switcher-track']
})
const switcherStyle = {
  '--switcher-label-color': props.labelColor
}

function changeValue() {
  model.value = !model.value
}
</script>
<style lang="scss" scoped>
.nihility-switcher {
  width: 100%;
  justify-content: space-between;

  input[type="checkbox"] {
    display: none;
  }

  .switcher-label {
    color: var(--switcher-label-color);
  }

  .switcher-track {
    width: 2.8em;
    height: 1.4em;
    cursor: pointer;
    overflow: hidden;
    border-radius: .7em;
    background-color: #fff;
    transition: background-color 0.25s;

    .switcher-core {
      width: 1.4em;
      height: 1.4em;
      transition: 300ms;
      border-radius: 50%;
      background-color: #fff;
      box-shadow: 0 0 20px #000;
    }

    &.is-active {
      background-color: #409eff;

      .switcher-core {
        transform: translateX(1.4em);
      }
    }
  }
}
</style>
