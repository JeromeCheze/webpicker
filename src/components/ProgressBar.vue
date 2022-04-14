<template>
  <div class="progress-bar__main" :style="style"></div>
</template>

<script lang="ts">
import Vue from 'vue'
export default Vue.extend({

  props: {

    value: {
      type: Number,
      required: true,
      default: 0
    },

    size: {
      type: Number,
      default: 3
    },

    color: {
      type: String,
      default: '#ffffff'
    }

  },

  computed: {

    style () {
      const v: number = this.value as number
      return {
        width: `${this.value != null ? this.value : 0}%`,
        display: this.value != null ? 'block' : 'none',
        height: `${this.size}px`,
        background: (
          this.value != null && this.color.toLowerCase() == '#ffffff' ?
          `hsl(${105 * v / 100}, 100%, 45%)` :
          this.color
        )
      }
    }

  }

})
</script>

<style>
.progress-bar__main {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10000;
}
</style>
