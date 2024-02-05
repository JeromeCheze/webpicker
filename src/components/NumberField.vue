<script setup lang="ts">
import { ref, watch } from 'vue'


const props = defineProps<{
  label: string
  modelValue?: number | null
}>()

const emit = defineEmits(['update:modelValue'])

const numberValue = ref(props.modelValue != null ? props.modelValue.toString() : null)

watch(() => props.modelValue, (newValue) => {
  numberValue.value = newValue!.toString()
})

function handleInput(ev: InputEvent) {
  if (ev.target == null) {
    return
  }
  const target = ev.target as HTMLInputElement
  const value = target.value
  if (value !== null && value !== '') {
    const v = parseFloat(value.replace(',', '.'))
    if (!isNaN(v)) {
      numberValue.value = value
      emit('update:modelValue', v)
    }
  } else {
    emit('update:modelValue', null)
  }
}
</script>

<template>
  <v-text-field
    v-bind="$attrs"
    :label="label"
    :model-value="numberValue"
    @change="handleInput"
    class="number-field__v-text-field"
  ></v-text-field>
</template>

<style lang="css">
.number-field__v-text-field input {
  text-align: right;
}
</style>
