<template>
  <div class="nihility-slider is-horizontal">
    <div class="slider-label">{{ label }}</div>
    <div class="slider-track-wrapper">
      <div ref="sliderTrack" class="slider-track">
        <div class="track-activated"></div>
        <div ref="sliderBlock" class="track-block">
          <div class="slider-tips">
            <slot name="tips" :value="tipsValue">
              {{ tipsValue }}
            </slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import {onMounted, ref, shallowRef} from 'vue'
import {DraggableElement} from '../utils/draggable'

const props = withDefaults(defineProps<{
  label: string,
  step?: number | string,
  min?: number | string,
  max?: number | string
}>(), {
  min: 0,
  step: 1,
  max: 100,
})
const model = defineModel<number | string>()
model.value = Math.max(Math.min(parseFloat(model.value), parseFloat(props.max)), parseFloat(props.min))
const emit = defineEmits(['change'])
const sliderBlock = shallowRef()
const sliderTrack = shallowRef()
const tipsValue = ref(model.value)

class SliderBlock extends DraggableElement {
  updateTask = null

  updateProgress(value: number) {
    if (this.updateTask) {
      cancelAnimationFrame(this.updateTask)
    }
    if (tipsValue.value !== value) {
      this.updateTask = requestAnimationFrame(() => {
        tipsValue.value = value
        model.value = value.toFixed(2)
        emit('change', model.value)
      })
    }
  }
}

onMounted(() => {
  const rect = sliderTrack.value.getBoundingClientRect()
  const initialX = rect.width * parseFloat(model.value) / parseFloat(props.max)
  new SliderBlock(sliderBlock.value, {
    initialX,
    maxY: 0,
    maxX: rect.width,
    fragment: true,
    step: parseFloat(props.step),
    minValue: parseFloat(props.min),
    maxValue: parseFloat(props.max),
  })
})
</script>
<style lang="scss" scoped>
.nihility-slider {
  width: 100%;

  &.is-horizontal {
    gap: 1em;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .slider-track-wrapper {
      flex-grow: 1;
      padding: 9px 4px;
    }
  }

  .slider-label {
    color: #fff;
  }

  .slider-track-wrapper {
    padding: 16px 4px;

    .slider-track {
      height: 4px;
      width: 100%;
      position: relative;
      border-radius: 1px;
      background: #e4e7ed;
      outline: 1px solid #fff;
      --draggable-element-translate: translate(0, 0);

      .track-block {
        top: -4px;
        left: -4px;
        width: 12px;
        height: 12px;
        transition: 100ms;
        position: absolute;
        border-radius: 50%;
        background-color: #fff;
        box-shadow: 0 0 2px 2px #0006;
        transform: var(--draggable-element-translate);

        .slider-tips {
          display: none;
        }

        &:hover {
          top: -6px;
          left: -6px;
          width: 16px;
          height: 16px;
          cursor: pointer;
          box-shadow: 0 0 2px 2px #409eff inset;
          transform: var(--draggable-element-translate);

          .slider-tips {
            padding: .5em;
            color: white;
            position: absolute;
            border-radius: 8px;
            background: #000c;
            display: inline-block;
            transform: translate(calc(8px - 50%), calc(-8px - 100%));
          }
        }
      }
    }
  }
}
</style>
