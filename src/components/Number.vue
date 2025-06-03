<template>
  <div class="nihility-number display-flex-center" :style="numberStyle">
    <div class="number-label">{{ label || '' }}</div>
    <input type="number" v-model="model" :min="minValue" :max="maxValue"/>
  </div>
</template>
<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string,
  labelColor?: string,
  minValue?: number,
  maxValue?: number
}>(), {labelColor: '#fff', minValue: 0, maxValue: Number.MAX_VALUE})
const model = defineModel({type: Number, default: 0})
const numberStyle = {
  '--number-label-color': props.labelColor
}
</script>

<style lang="scss" scoped>
.nihility-number {
  width: 100%;
  justify-content: space-between;

  .number-label {
    color: var(--number-label-color);
  }

  input[type=number] {
    padding: 4px;
    width: 94px;

    &:focus-visible {
      outline: none;
      border-radius: 2px;
      border: 2px solid transparent;
      box-shadow: 0 0 0 2px #409eff;
    }
  }
}
</style>
