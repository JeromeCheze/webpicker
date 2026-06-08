<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="not-found">
    <h1>404 - Not Found</h1><br>
  </div>
  <div>{{ route.fullPath }}</div>
</template>

<style>
@media (min-width: 1024px) {
  .not-found {
    min-height: 100vh;
    display: flex;
    align-items: center;
  }
}
</style>