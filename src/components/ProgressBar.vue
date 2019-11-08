<template>
  <div class="progress-bar__main" :style="style"></div>
</template>

<script>
export default {

  props: {

    value: {
      required: true,
      default: null
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
      return {
        width: `${this.value != null ? this.value : 0}%`,
        display: this.value != null ? 'block' : 'none',
        height: `${this.size}px`,
        background: (
          this.value != null && this.color.toLowerCase() == '#ffffff' ?
          `hsl(${105 * this.value / 100}, 100%, 45%)` :
          this.color
        )
      }
    }

  }

}
</script>

<style>
.progress-bar__main {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10000;
}
</style>
