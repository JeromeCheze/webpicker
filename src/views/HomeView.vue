<script setup lang="ts">
import version from '@/version.json'
</script>

<template>
  <v-card max-width="1000" :style="{ marginLeft: 'auto', marginRight: 'auto', marginTop: '5vh' }" class="pa-4">
    <v-card-text>
      <div class="text-center mt-12 font-doto">WebPicker</div>
      <div class="text-center">
        <img src="@/assets/wp_logo.svg" height="400" class="my-6">
      </div>
      <div class="text-caption text-center">- {{ version }} -</div>
    </v-card-text>
  </v-card>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Doto:wght@100..900&display=swap');

.font-doto {
  font-size: 6rem;
  font-family: "Doto", serif;
  font-optical-sizing: auto;
  font-weight: 900;
  font-style: normal;
  font-variation-settings: "ROND" 0;
}
</style>