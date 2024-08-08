<script setup lang="ts">
import { ref, useAttrs, watch } from 'vue'


const props = defineProps<{
  modelValue: Date | null
  time?: boolean | undefined
}>()

const attrs = useAttrs()

const emit = defineEmits(['update:modelValue'])

const dateValue = ref(null as string | null)
const dateRe = /^\d{4}-\d{2}-\d{2}$/
const datetimeRe = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

watch(() => props.modelValue, (value) => {
  let v = (value == null ? new Date() : value).toISOString().replace('T', ' ').slice(0, 19)
  if (!props.time) {
    v = v.split(' ')[0]
  }
  dateValue.value = v
}, { immediate: true })

function checkDate(v: string) {
  const re = props.time ? datetimeRe : dateRe
  const fmt = props.time ? 'YYYY-mm-dd HH:MM:SS' : 'YYYY-mm-dd'
  return re.test(v) || fmt
}

function handleInput(ev: InputEvent) {
  if (ev.target == null) {
    return
  }
  const target = ev.target as HTMLInputElement
  const value = target.value
  const re = props.time ? datetimeRe : dateRe
  if (value !== null && re.test(value)) {
    const v = props.time
      ? new Date(Date.parse(`${value.replace(' ', 'T')}Z`))
      : new Date(Date.parse(`${value}T00:00:00Z`))
    emit('update:modelValue', v)
  }
}
</script>

<template>
  <v-text-field
    v-bind="attrs"
    :model-value="dateValue"
    @change="handleInput"
    :rules="[checkDate]"
  ></v-text-field>
</template>
