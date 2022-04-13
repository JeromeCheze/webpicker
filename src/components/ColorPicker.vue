<template>
  <div>
    <div class="color-picker__box-color" :style="{ background: value }" @click="active = !active"></div>
    <div :style="{ display: 'inline-block' }">
      <v-menu offset-y v-model="active" :close-on-content-click="false">
        <template v-slot:activator="{ on }">
          <v-text-field v-on="on" :value="value" @input="$emit('input', $event)" :label="label"></v-text-field>
        </template>
        <chrome-picker :value="value" @input="handleInput"></chrome-picker>
      </v-menu>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
export default Vue.extend({

  props: ['value', 'label', 'format'],

  data () {
    return {
      active: false
    }
  },

  methods: {
    handleInput (val) {
      let result
      if (this.format == 'hex') {
        result = val.hex
      } else if (this.format == 'rgba') {
        result = `rgba(${val.rgba.r},${val.rgba.g},${val.rgba.b},${val.rgba.a})`
      }
      this.$emit('input', result)
    }
  }

})
</script>

<style lang="css">
.color-picker__box-color {
  display: inline-block;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid gray;
  margin: 4px;
  cursor: pointer;
}
</style>
