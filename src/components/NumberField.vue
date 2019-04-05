<template>
  <v-text-field
    v-bind="$attrs"
    :label="label"
    :value="numberValue"
    @change="handleInput"
    class="number-field__v-text-field"
  ></v-text-field>
</template>

<script>
export default {

  props: ['label', 'value'],

  data () {
    return {
      numberValue: this.value != null ? this.value.toString() : null
    }
  },

  watch: {
    value: function (newValue, oldValue) {
      this.numberValue = newValue
    }
  },

  methods: {

    handleInput (ev) {
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

}
</script>

<style lang="css">
.number-field__v-text-field input {
  text-align: right;
}
</style>
