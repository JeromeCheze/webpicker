<template>
  <div>
    <el-form :inline="true"  :model="form" label-width="300px">
      <h1>Settings</h1>
      <h3>Picker</h3>
      <h4>Colors</h4>
      <el-form-item label="Text amplitude value"><el-color-picker v-model="form.amplitudeValue"></el-color-picker></el-form-item>
      <el-form-item label="Waveform background"><el-color-picker v-model="form.background" show-alpha></el-color-picker></el-form-item>
      <el-form-item label="Waveform background even"><el-color-picker v-model="form.backgroundEven" show-alpha></el-color-picker></el-form-item>
      <el-form-item label="Grid"><el-color-picker v-model="form.grid" show-alpha></el-color-picker></el-form-item>
      <el-form-item label="Waveform selected"><el-color-picker v-model="form.selected" show-alpha></el-color-picker></el-form-item>
      <el-form-item label="Selected time window"><el-color-picker v-model="form.selectedWindow" show-alpha></el-color-picker></el-form-item>
      <el-form-item label="Border"><el-color-picker v-model="form.border"></el-color-picker></el-form-item>
      <el-form-item label="X axis text"><el-color-picker v-model="form.text"></el-color-picker></el-form-item>
      <el-form-item label="Label background"><el-color-picker v-model="form.labelBackground" show-alpha></el-color-picker></el-form-item>
      <el-form-item label="Label text"><el-color-picker v-model="form.labelText"></el-color-picker></el-form-item>
      <el-form-item label="Line"><el-color-picker v-model="form.line"></el-color-picker></el-form-item>
      <el-form-item label="Average line"><el-color-picker v-model="form.avgLine"></el-color-picker></el-form-item>
      <el-form-item label="Pick theoretical"><el-color-picker v-model="form.theoretical"></el-color-picker></el-form-item>
      <el-form-item label="Pick automatic"><el-color-picker v-model="form.automatic"></el-color-picker></el-form-item>
      <el-form-item label="Pick manual"><el-color-picker v-model="form.manual"></el-color-picker></el-form-item>
    </el-form>
  </div>
</template>

<script>
export default {
  data () {
    return {
      form: {
        // global
        amplitudeValue: '#808080',
        background: 'rgba(255, 255, 255, 1)',
        backgroundEven: 'rgba(229, 238, 241, 1)',
        grid: 'rgba(180,180,180,.3)',
        selected: 'rgba(200, 231, 249, 1)',
        selectedWindow: 'rgba(0, 0, 0, 0.1)',
        border: '#000000',
        text: '#000000',
        // label
        labelBackground: 'rgba(75, 75, 75, 0.8)',
        labelText: '#ffffff',
        // line
        line: '#9cb9c9',
        avgLine: 'rgba(180,180,180,.3)',//'#a6dfea',
        // phases
        theoretical: '#0000ff',
        automatic: '#ff0000',
        manual: '#1ab11b'
      }
    }
  }
}
</script>

<style>

</style>
