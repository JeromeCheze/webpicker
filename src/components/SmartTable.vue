<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { setLocalStorage, getLocalStorageDefault } from '@/utils'
import type { ColObject } from '@/types'

const props = defineProps<{
  storeKey?: string
  tableHeight?: number
  items: any[]
  cols: ColObject[]
  sortCol?: number
  sortOrder?: 'asc' | 'desc'
  selectable?: boolean
  selected?: any[]
  rowClass?: (item: any) => string
  rowColor?: (item: any) => string
}>()

const emit = defineEmits(['rowClick', 'selection'])
const tableConfigDialog = ref(false)
const sortCol = ref(props.sortCol != null ? props.sortCol : 0)
const sortOrder = ref(props.sortOrder != null ? props.sortOrder : 'desc')
const selectAllStatus = ref(true as boolean | null)
const modelValue = ref([] as [boolean, any][])

const enabledCols = computed(() => props.cols.filter(x => x.enabled))

watch(() => props.items, () => {
  initItems()
  applySort()
})

watch(() => props.selected, () => {
  applySelection()
})

function initItems() {
  if (props.storeKey != null) {
    for (const col of props.cols) {
      const key = `${props.storeKey}.${col.label}`
      col.enabled = getLocalStorageDefault(key, col.enabled)
    }
  }
  modelValue.value = props.items.map(x => [true, x])
  applySelection()
}

function applySelection() {
  if (props.selected != null) {
    for (const row of modelValue.value) {
      if (props.selected.indexOf(row[1]) >= 0) {
        row[0] = true
      } else {
        row[0] = false
      }
    }
  }
  setSelectAllStatus()
}

function applySort() {
  modelValue.value.sort((a, b) => {
    const aa = enabledCols.value[sortCol.value].valueAccessor(a[1])
    const bb = enabledCols.value[sortCol.value].valueAccessor(b[1])
    if (aa == null || bb == null) {
      return 0
    }
    return aa < bb ? -1 : aa > bb ? 1 : 0
  })
  if (sortOrder.value === 'desc') {
    modelValue.value.reverse()
  }
}

function handleSortCol(index: number) {
  if (index === sortCol.value) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortCol.value = index
  }
  applySort()
}

function handleRowClick(item: any) {
  emit('rowClick', item)
}

function setAllSelection(value: boolean) {
  for (const row of modelValue.value) {
    row[0] = value
  }
  emitSelected()
}

function setSelectAllStatus() {
  let selectedCount = 0
  let unselectedCount = 0
  for (const row of modelValue.value) {
    if (row[0] === true) {
      selectedCount++
    } else {
      unselectedCount++
    }
  }
  if (selectedCount === modelValue.value.length) {
    selectAllStatus.value = true
  } else if (unselectedCount === modelValue.value.length) {
    selectAllStatus.value = false
  } else {
    selectAllStatus.value = null
  }
}

function handleSelectAllClick() {
  if (selectAllStatus.value === true) {
    selectAllStatus.value = false
    setAllSelection(false)
  } else if (selectAllStatus.value === false || selectAllStatus.value == null) {
    selectAllStatus.value = true
    setAllSelection(true)
  }
}

function emitSelected() {
  const selected = []
  for (const currRow of modelValue.value) {
    if (currRow[0] === true) {
      selected.push(currRow[1])
    }
  }
  emit('selection', selected)
}

function handleSelection(row: any) {
  row[0] = !row[0]
  setSelectAllStatus()
  emitSelected()
}

function getClass(row: any) {
  return props.rowClass != null ? props.rowClass(row[1]) : ''
}

function getColor(row: any) {
  return props.rowColor != null ? props.rowColor(row[1]) : ''
}

function storeValue(col: ColObject, value: boolean) {
  if (props.storeKey != null) {
    const key = `${props.storeKey}.${col.label}`
    setLocalStorage(key, value)
  }
}

onMounted(() => {
  initItems()
  applySort()
  setSelectAllStatus()
})
</script>

<template>
  <v-table fixed-header :height="props.tableHeight" density="compact" hover>
    <thead>
      <tr>
        <th v-if="props.selectable === true">
          <v-checkbox
            hide-details
            :model-value="selectAllStatus"
            :indeterminate="selectAllStatus == null"
            @click="handleSelectAllClick"
            density="compact"
          ></v-checkbox>
        </th>
        <th v-for="(item, index) in enabledCols" @click="handleSortCol(index)">
          <v-icon v-if="index === sortCol && sortOrder === 'asc'">mdi-chevron-up</v-icon>
          <v-icon v-if="index === sortCol && sortOrder === 'desc'">mdi-chevron-down</v-icon>
          {{ item.label }}
        </th>
        <th>
          <v-btn size="x-small" variant="plain" @click="tableConfigDialog = true">
            <v-icon>mdi-wrench</v-icon>
          </v-btn>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="props.items.length === 0">
        <td :colspan="`${enabledCols.length + 1}`" class="text-center pa-5">
          <slot></slot>
        </td>
      </tr>
      <tr
        v-else
        v-for="(row, index) in modelValue" 
        @click="handleRowClick(row[1])"
        :class="getClass(row)"
        :style="{ background: getColor(row) }"
      >
        <td v-if="props.selectable">
          <v-checkbox
            hide-details
            :model-value="row[0]"
            @click="handleSelection(row)"
            density="compact"
          ></v-checkbox>
        </td>
        <td
          v-for="(item, index) in enabledCols"
          :class="item.class ? item.class(row[1]) : ''"
          class="text-no-wrap"
          :colspan="index === (enabledCols.length - 1) ? 2 : 1"
        >
          <v-icon
            v-if="item.icon != null && item.valueAccessor(row[1])"
            :title="item.textAccessor(row[1])"
          >{{ item.icon }}</v-icon>
          <span v-else>{{ item.textAccessor(row[1]) }}</span>
        </td>
      </tr>
    </tbody>
  </v-table>
  <v-dialog v-model="tableConfigDialog" width="900">
    <v-card>
      <v-card-title>Table column selection</v-card-title>
      <v-table>
        <thead>
          <tr>
            <th v-for="col in props.cols">{{ col.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td v-for="col in props.cols">
              <v-checkbox v-model="col.enabled" density="compact" hide-details @update:modelValue="value => storeValue(col, value)"></v-checkbox>
            </td>
          </tr>
        </tbody>
      </v-table>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="tableConfigDialog = false" color="primary">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>