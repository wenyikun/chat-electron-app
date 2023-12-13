<script setup lang="ts">
import { nextTick, ref } from 'vue'
// @ts-ignore
import { Viewer } from '@bytemd/vue-next'
import highlight from '@bytemd/plugin-highlight'
import gfm from '@bytemd/plugin-gfm'
import math from '@bytemd/plugin-math'
import 'highlight.js/styles/vs2015.css'
import './markdown.css'

const messages = ref<
  {
    role: 'user' | 'assistant'
    content: string
  }[]
>([])
const plugins = [
  highlight(),
  gfm(),
  math({
    katexOptions: {
      output: 'html',
    },
  }),
]

window.toolApi.getPrintMessages().then(async (data) => {
  messages.value = data
  await nextTick()
  window.toolApi.printToPDF()
})
</script>

<template>
  <div class="p-2">
    <template v-for="(item, index) in messages">
      <div v-if="item.role === 'user'" :key="index" class="flex gap-4 mx-auto px-3 py-2">
        <div class="w-8 h-8 shrink-0 bg-blue rounded">
          <img class="block w-full h-full" src="./assets/chatbot.svg" />
        </div>
        <div class="text-base">{{ item.content }}</div>
      </div>
      <div v-if="item.role === 'assistant'" :key="index" class="mb-6 mx-auto p-3">
        <div class="flex gap-4">
          <div class="w-8 h-8 flex shrink-0 bg-[--primary-color] rounded">
            <img class="block m-auto w-80% h-80%" src="./assets/openai.svg" />
          </div>
          <Viewer :value="item.content" :plugins="plugins"></Viewer>
        </div>
      </div>
    </template>
  </div>
</template>