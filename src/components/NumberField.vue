<script setup lang="ts">
import { ref, useAttrs, watch } from 'vue'


const props = defineProps<{
  modelValue?: number | string | null
  required?: boolean | undefined
}>()

const attrs = useAttrs()

const emit = defineEmits(['update:modelValue'])

const numberValue = ref(props.modelValue != null
  ? typeof props.modelValue === 'string'
    ? parseFloat(props.modelValue as string)
    : props.modelValue
  : null)
const reFloat = /^-?\d+(\.\d+)?$/

watch(() => props.modelValue, (value) => {
  numberValue.value = value != null
    ? typeof value === 'string'
      ? parseFloat(value)
      : value
    : null
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
      numberValue.value = v
      emit('update:modelValue', v)
    }
  } else {
    emit('update:modelValue', null)
  }
}

function checkValue(v: string | null) {
  if (v != null) {
    return reFloat.test(v) || 'Invalid value'
  }
  if (props.required) {
    return v != null || 'Field required'
  }
  return true
}
</script>

<template>
  <v-text-field
    v-bind="attrs"
    :model-value="numberValue"
    @change="handleInput"
    class="number-field__v-text-field"
    :rules="[checkValue]"
  ></v-text-field>
</template>

<style lang="css">
.number-field__v-text-field input {
  text-align: right;
}
</style>
