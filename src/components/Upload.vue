<template>
  <div class="nihility-uploader is-horizontal">
    <div class="uploader-label">{{ label }}</div>
    <div class="uploader-box display-flex-center">
      <label class="display-flex-center" @click="reset">
        <img :src="thumbnail" alt="" v-if="thumbnail"/>
        <input type="file" @change="change($event)"/>
        <Delete v-if="thumbnail" @click="clearBackground"/>
        <Plus v-else/>
      </label>
    </div>
  </div>
</template>
<script setup lang="ts">
import Plus from './icons/Plus.vue'
import Delete from './icons/Delete.vue'

defineProps<{ label: string, thumbnail: string }>()
const model = defineModel()
const emit = defineEmits(['clear', 'change'])

function reset() {
  model.value = ''
}

function clearBackground(e: Event) {
  e.stopPropagation()
  e.preventDefault()
  emit('clear')
}

function change(e: Event) {
  emit('change', e.target.files)
}
</script>
<style lang="scss" scoped>
.nihility-uploader {
  width: 100%;

  .uploader-label {
    color: #fff;
  }

  .uploader-box {
    width: 100%;
    padding: .5em 0;

    label {
      gap: 1em;
      width: 100px;
      height: 100px;
      cursor: pointer;
      position: relative;
      border: 2px dashed #fff9;

      svg {
        fill: white;
        color: white;
        font-size: 20px;

        &:hover {
          stroke: white;
          font-weight: bold;
          stroke-width: 2em;
          transform: scale(1.1);
        }
      }

      img {
        width: 100%;
        height: 100%;
        position: absolute;
        object-fit: contain;
      }

      input[type='file'] {
        display: none;
      }
    }

    label:hover {
      border: 2px dashed #fff;

      img {
        z-index: -1;
      }
    }
  }

  &.is-horizontal {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;

    .uploader-box {
      width: auto;
    }
  }
}
</style>
