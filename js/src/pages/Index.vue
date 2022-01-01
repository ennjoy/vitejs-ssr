<script setup>
const count = ref(0)

function click() {
  count.value++
}
</script>

<template>
  <h1>Home</h1>
  <p>{{ count }}</p>
  <button @click="click">Click</button>
</template>

<style scoped>

</style>

<route lang="yaml">
name: Index
meta:
  layout: Default
</route>