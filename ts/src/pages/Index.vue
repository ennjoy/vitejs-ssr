<script lang="ts" setup>
const count: number = ref(0)

function click() {
  count.value++
}
</script>

<template>
  <h1>Home</h1>
  <p>{{ count }}</p>
  <button @click="click">Click</button>
</template>

<script setup>

</script>

<style scoped>

</style>

<route lang="yaml">
name: Index
meta:
  layout: Default
</route>