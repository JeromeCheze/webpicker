<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import { useAppStore } from '@/stores/app'
import type Lichen from '@/lib/lichen/src'

const store = useAppStore()

const emit = defineEmits(['update'])

const props = defineProps<{
  timeWindow: [number, number]
  listTimeWindow: [number, number]
  chart: Lichen | null
}>()

const slider = ref()
const style = ref({
  display: 'none',
  position: 'absolute',
  top: '0px',
  left: '0px',
  width: '0px',
  height: '0px',
  background: 'rgba(255, 0, 0, 0.5)',
  opacity: 0.5,
  zIndex: 1100,
  cursor: 'move'
} as CSSProperties)

let mouse: MouseEvent | null = null

function updateSlider() {
  if (props.chart == null
    || props.timeWindow[1] < props.listTimeWindow[0]
    || props.timeWindow[0] > props.listTimeWindow[1]
  ) {
    style.value.display = 'none'
    return
  }
  const parent = slider.value.parentNode.getBoundingClientRect()
  const plot = props.chart.master.getRegistered('PLOT')
  const bcr = plot.canvas.getBoundingClientRect()
  const xPos1 = Math.max(
    plot.dataUtils.xPosFromValue(props.timeWindow[0]),
    plot.dataUtils.xPosFromValue(props.listTimeWindow[0])
  )
  const xPos2 = Math.min(
    plot.dataUtils.xPosFromValue(props.timeWindow[1]),
    plot.dataUtils.xPosFromValue(props.listTimeWindow[1])
  )
  const width = xPos2 - xPos1
  Object.assign(style.value, {
    top: `${bcr.top - parent.top}px`,
    left: `${xPos1 + bcr.left - parent.left}px`,
    height: `${plot.canvas.height}px`,
    width: `${width}px`,
    display: 'block',
    background: store.settings['color.activeTimeWindow'],
  })
}

function handleMouseDown(e: MouseEvent) {
  mouse = e
}

function handleMouseUp() {
  mouse = null
}

function handleMouseMove(e: MouseEvent) {
  if (mouse == null || props.chart == null) {
    return
  }
  const delta = e.clientX - mouse.clientX
  if (Math.abs(delta) > 5) {
    const dataUtils = props.chart.master.getRegistered('DATA_UTILS')
    const timeDelta = dataUtils.xValueFromPos(e.clientX) - dataUtils.xValueFromPos(mouse.clientX)
    emit('update', [props.timeWindow[0] + timeDelta, props.timeWindow[1] + timeDelta])
    mouse = e
  }
}

watch([
  () => store.settings,
  () => props.chart,
  () => props.timeWindow,
  () => props.listTimeWindow
], updateSlider)

onMounted(() => {
  slider.value.addEventListener('mousedown', handleMouseDown)
  document.body.addEventListener('mousemove', handleMouseMove)
  document.body.addEventListener('mouseup', handleMouseUp)
})

onBeforeUnmount(() => {
  slider.value.removeEventListener('mousedown', handleMouseDown)
  document.body.removeEventListener('mousemove', handleMouseMove)
  document.body.removeEventListener('mouseup', handleMouseUp)
})

defineExpose({ updateSlider })
</script>

<template>
  <div ref="slider" :style="style"></div>
</template>