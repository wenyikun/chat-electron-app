<script setup lang="ts">
import { nextTick, ref } from 'vue'
// @ts-ignore
import { Viewer } from '@bytemd/vue-next'
import highlight from '@bytemd/plugin-highlight'
import gfm from '@bytemd/plugin-gfm'
import math from '@bytemd/plugin-math'
import 'highlight.js/styles/vs2015.css'
import './markdown.css'
import { MessageType } from './utils/types'

const messages = ref<MessageType[]>([])
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
        <div class="text-base">
          {{ item.content }}
          <div v-if="item.files?.length" class="flex gap-2 py-2 flex-wrap">
            <img
              v-for="(list, idx) in item.files"
              :key="idx"
              :src="`data:${list.mimeType};base64,${list.data}`"
              class="block w-40 h-40 object-cover"
            />
          </div>
        </div>
      </div>
      <div v-if="item.role === 'assistant'" :key="index" class="mb-6 mx-auto p-3">
        <div class="flex gap-4">
          <div v-if="item.type === 'gemini'" class="w-8 h-8 flex shrink-0 bg-white rounded">
            <img class="block m-auto w-80% h-80%" src="./assets/gemini.gif" />
          </div>
          <div v-else class="w-8 h-8 flex shrink-0 bg-[--primary-color] rounded">
            <img class="block m-auto w-80% h-80%" src="./assets/openai.svg" />
          </div>
          <Viewer :value="item.content" :plugins="plugins"></Viewer>
        </div>
      </div>
    </template>
  </div>
</template>
