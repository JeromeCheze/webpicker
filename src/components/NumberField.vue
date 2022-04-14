<template>
  <v-text-field
    v-bind="$attrs"
    :label="label"
    :value="numberValue"
    @change="handleInput"
    class="number-field__v-text-field"
  ></v-text-field>
</template>

<script lang="ts">
import Vue from 'vue'
export default Vue.extend({

  props: {
    label: {
      type: String
    },
    value: {
      type: Number
    }
  },

  data () {
    return {
      numberValue: this.value != null ? this.value.toString() : null
    }
  },

  watch: {
    value: function (newValue) {
      this.numberValue = newValue
    }
  },

  methods: {

    handleInput (ev: string) {
      if (ev != null && ev != '') {
        let v = parseFloat(ev.replace(',', '.'))
        if (!isNaN(v)) {
          this.numberValue = ev
          this.$emit('input', v)
        }
      } else {
        this.$emit('input', null)
      }
    }

  }

})
</script>

<style lang="css">
.number-field__v-text-field input {
  text-align: right;
}
</style>
