<template>
  <div class="keybinding-field" :class="{ active: active }" @click="active = !active">
    <div class="keybinding-field--label">{{ label }}</div>
    <div class="keybinding-field--input">{{ value }}</div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
export default Vue.extend({

  props: ['value', 'keyValue', 'label'],

  data () {
    return {
      active: false
    }
  },

  watch: {
    keyValue: function (newValue, oldValue) {
      if (this.active) {
        this.$emit('input', newValue)
      }
    }
  }

})
</script>

<style lang="css">
.keybinding-field {
  width: 200px;
  padding: 4px;
  border: 1px solid gray;
  border-radius: 8px;
  cursor: pointer;
  margin: 4px;
}
.keybinding-field.active {
  border: 1px solid #1f85d7;
  cursor: crosshair;
}
.keybinding-field--label {
  font-size: 12px;
  /* color: rgba(0,0,0,.54) */
}
.keybinding-field--input {
  padding: 4px;
  text-align: center;
}
</style>
