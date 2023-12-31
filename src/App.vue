<script setup lang="ts">
import Button from 'primevue/button'
// import Avatar from 'primevue/avatar'
import Textarea from 'primevue/textarea'
import InputText from 'primevue/inputtext'
import ScrollPanel from 'primevue/scrollpanel'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import TieredMenu from 'primevue/tieredmenu'
import Image from 'primevue/image'
import ConfigDialog from './components/ConfigDialog.vue'
import { ref, onMounted, nextTick, computed } from 'vue'
// @ts-ignore
import { Viewer } from '@bytemd/vue-next'
import highlight from '@bytemd/plugin-highlight'
import gfm from '@bytemd/plugin-gfm'
import math from '@bytemd/plugin-math'
import 'highlight.js/styles/vs2015.css'
import './markdown.css'
import copyIcon from './assets/copy.svg?raw'
import copiedIcon from './assets/copied.svg?raw'
import { copyText, fileToGenerativePart } from './utils'
import { FileDetail, MessageType } from './utils/types'

const toast = useToast()
const content = ref('')
const configVisible = ref(false)
const configRef = ref()
const messages = ref<MessageType[]>([])
const plugins = [
  {
    viewerEffect({ markdownBody }: any) {
      // 复制按钮插件
      const els = markdownBody.querySelectorAll('pre>code')
      if (els.length === 0) return
      els.forEach((el: any) => {
        const parentNode = el.parentNode
        if (parentNode.querySelector('.copy')) {
          return
        }
        const span = document.createElement('span')
        span.innerHTML = copyIcon
        span.className = 'copy'
        let timer: any
        // const content = el.innerHTML
        span.onclick = function () {
          copyText(el.innerText)
          span.innerHTML = copiedIcon
          span.className = 'copy copied'
          clearTimeout(timer)
          timer = setTimeout(() => {
            span.innerHTML = copyIcon
            span.className = 'copy'
          }, 2000)
        }
        parentNode.insertBefore(span, el)
      })
    },
  },
  highlight(),
  gfm(),
  math({
    katexOptions: {
      output: 'html',
    },
  }),
]
const sidebarVisible = ref(false)
const conversations = ref<any[]>([])
const chatId = ref('')
const chatting = ref(false)
const scrollPanel = ref()
const chatListsRef = ref()
let pageNum = 1
const pageSize = 20
let finished = false
const operatorMenu = ref()
let currentChat: any = null
const showMenu = ref(false)
const renameInputRef = ref()
const operatorItems = [
  {
    label: '重命名',
    icon: 'pi pi-pencil',
    command: () => {
      currentChat.showInput = true
      nextTick(() => {
        // 选中文本
        renameInputRef.value[0].$el.select()
      })
    },
  },
  {
    label: '删除',
    icon: 'pi pi-trash',
    command: () => {
      window.db.deleteConversation(currentChat.id)
      const index = conversations.value.findIndex((item) => item.id === currentChat.id)
      conversations.value.splice(index, 1)
      createNewChat()
      currentChat = null
    },
  },
]
const bottomLine = ref()
const chatWrap = ref()
const inputFileRef = ref()
const imageParts = ref<FileDetail[]>([])
const apiModel = computed(() => configRef.value?.apiModel)

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    const content = chatWrap.value.$el.querySelector('.p-scrollpanel-content')
    const bottomLineTop = bottomLine.value.offsetTop
    const chatWrapHeight = chatWrap.value.$el.offsetHeight
    const chatWrapTop = content.scrollTop
    if (bottomLineTop > chatWrapHeight + chatWrapTop) {
      // 底部会出现边距
      // bottomLine.value.scrollIntoView({ behavior: 'smooth' })
      content.scrollTo({
        top: bottomLineTop - chatWrapHeight,
      })
    }
  })
}

// 加载聊天记录
const loadChatLists = () => {
  if (finished) {
    return
  }
  return window.db
    .getConversations({
      pageNum,
      pageSize,
    })
    .then((rows) => {
      conversations.value.push(...rows)
      if (rows.length < pageSize) {
        finished = true
        return
      }
      pageNum++
    })
}

// 初始化，如果未出现滚动条，继续加载
const initChatLists = () => {
  return loadChatLists()?.then(() => {
    if (scrollPanel.value.$el.offsetHeight + 10 > chatListsRef.value.offsetHeight) {
      initChatLists()
    }
  })
}

onMounted(() => {
  const scrollPanelContent = scrollPanel.value.$el.querySelector('.p-scrollpanel-content')
  scrollPanelContent.addEventListener('scroll', () => {
    if (scrollPanel.value.$el.offsetHeight + scrollPanelContent.scrollTop >= chatListsRef.value.offsetHeight) {
      loadChatLists()
    }
  })
  initChatLists()
  let timer: any
  window.addEventListener('resize', () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (scrollPanel.value.$el.offsetHeight + 10 > chatListsRef.value.offsetHeight) {
        initChatLists()
      }
    }, 200)
  })
})

// 发送聊天
// let requestId = ''
const handleEnd = (content: string) => {
  messages.value[messages.value.length - 1].content = content
  window.db.updateConversation({
    id: chatId.value,
    conversations: JSON.stringify(messages.value),
  })
  chatting.value = false
}
let controller: AbortController | null = null
const sendConversation = async () => {
  if (chatting.value) {
    return
  }
  const config = configRef.value.getConfig()
  chatting.value = true
  messages.value.push({
    role: 'user',
    content: content.value,
    files: [...imageParts.value],
  })
  // 判断 id 是否存在，不存在则新建，存在则更新
  if (!chatId.value) {
    await window.db
      .insertConversation({
        title: content.value.substring(0, 50),
        conversations: JSON.stringify(messages.value),
      })
      .then((res) => {
        chatId.value = res[0]
        pageNum = 1
        finished = false
        conversations.value = []
        initChatLists()?.then(() => {
          currentChat = conversations.value[0]
        })
      })
  } else {
    await window.db.updateConversation({
      id: chatId.value,
      conversations: JSON.stringify(messages.value),
    })
  }
  const sends = messages.value.slice(-9) // 发送4条历史
  let received = ''
  let blink = '<span class="blink">|</span>'
  messages.value.push({
    role: 'assistant',
    type: config.apiType,
    content: blink,
  })
  scrollToBottom()
  // requestId = apiUrl.value + '?t=' + Date.now()
  controller = new AbortController()
  if (config.apiType === 'gemini') {
    let contents: any[] = []
    if (config.apiModel === 'gemini-pro-vision') {
      // gemini-pro-vision 必须要带图片，并且不能多轮聊天
      if (!imageParts.value.length) {
        toast.add({ severity: 'error', summary: '提示', detail: 'gemini-pro-vision模型需要添加图片！', life: 5000 })
        return
      }
      contents = [
        {
          role: 'user',
          parts: [
            {
              text: content.value,
            },
            ...imageParts.value.map((item) => ({ inline_data: item })),
          ],
        },
      ]
    } else {
      contents = sends.map((item) => ({
        role: item.role === 'assistant' ? 'model' : item.role,
        parts: [
          {
            text: item.content,
          },
        ],
      }))
    }
    content.value = ''
    imageParts.value.length = 0
    fetch(`${config.apiHost}/v1beta/models/${config.apiModel}:streamGenerateContent?key=${config.apiKey}&alt=sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
      }),
      signal: controller.signal,
    })
      .then(async (resp) => {
        if (resp.status !== 200) {
          handleEnd(received)
          const res = await resp.json()
          toast.add({ severity: 'error', summary: '提示', detail: res.error.message, life: 5000 })
          return
        }
        const reader = resp.body!.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { value, done } = await reader.read()
          if (done) {
            handleEnd(received)
            return
          }
          const chunkValue = decoder.decode(value)
          chunkValue.split('data:').forEach((item) => {
            const str = item.trim()
            if (!str) {
              return
            }
            received += JSON.parse(str).candidates[0]?.content?.parts[0]?.text || ''
            messages.value[messages.value.length - 1].content = received + blink
            scrollToBottom()
          })
        }
      })
      .catch((err) => {
        handleEnd(received)
        if (err.name === 'AbortError') {
          return
        }
        toast.add({ severity: 'error', summary: '提示', detail: '网络错误，请重试！', life: 5000 })
      })
    return
  }
  const contents = sends.map((item) => ({
    role: item.role,
    content: item.content,
  }))
  content.value = ''
  fetch(config.apiHost + '/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: config.apiModel,
      messages: contents,
      stream: true,
    }),
    headers: {
      Authorization: 'Bearer ' + config.apiKey,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
  })
    .then(async (resp) => {
      if (resp.status !== 200) {
        handleEnd(received)
        const res = await resp.json()
        toast.add({ severity: 'error', summary: '提示', detail: res.error.message, life: 5000 })
        return
      }
      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          return
        }
        const chunkValue = decoder.decode(value)
        chunkValue.split('data:').forEach((item) => {
          const str = item.trim()
          if (!str) {
            return
          }
          if (str === '[DONE]') {
            handleEnd(received)
            return
          }
          received += JSON.parse(str).choices[0].delta?.content || ''
          messages.value[messages.value.length - 1].content = received + blink
          scrollToBottom()
        })
      }
    })
    .catch((err) => {
      handleEnd(received)
      if (err.name === 'AbortError') {
        return
      }
      toast.add({ severity: 'error', summary: '提示', detail: '网络错误，请重试！', life: 5000 })
    })
}

// 停止聊天输出
const abortConversation = () => {
  // window.netApi.abort(requestId)
  controller?.abort()
  controller = null
}

// 选择聊天列
const onselectConversation = (chat: any) => {
  if (chatId.value === chat.id || (currentChat && !currentChat.title.trim())) {
    return
  }
  chatId.value = chat.id
  currentChat && (currentChat.showInput = false)
  currentChat = chat
  window.db.getConversation(chat.id).then((row) => {
    messages.value = JSON.parse(row.conversations)
    scrollToBottom()
  })
}

// 新建聊天
const createNewChat = () => {
  chatId.value = ''
  messages.value = []
}

// 按键监听，回车发送信息
const handleKeydown = (event: KeyboardEvent) => {
  if (event.keyCode === 13 && !event.shiftKey) {
    const value = content.value.trim()
    value && sendConversation()
    event.preventDefault()
  }
}

// 切换操作按钮显示
const toggleMenuVisible = async (event: Event) => {
  showMenu.value = false
  await nextTick()
  showMenu.value = true
  await nextTick()
  operatorMenu.value.toggle(event)
}

// 失去焦点，更新标题
const onChangeRename = () => {
  const title = currentChat.title.trim()
  if (!title) {
    return
  }
  window.db.updateConversation({
    id: currentChat.id,
    title,
  })
  currentChat.showInput = false
}

// 导出 PDF
const onExportPDF = () => {
  if (!messages.value.length) {
    toast.add({ severity: 'info', summary: '提示', detail: '无内容可导出！', life: 5000 })
    return
  }
  window.toolApi.openPrintView(JSON.parse(JSON.stringify(messages.value)))
}

// 点击上传图片按钮
const onSelectFile = () => {
  inputFileRef.value.click()
}

const onFileChange = (event: any) => {
  const files = event.target.files
  Promise.all([...files].slice(0, 5 - imageParts.value.length).map(fileToGenerativePart)).then((res) => {
    imageParts.value.unshift(...res)
  })
  event.target.value = ''
}

const onDeleteImg = (index: number) => {
  imageParts.value.splice(index, 1)
}

// 复制内容
const onCopyContent = (text: string) => {
  try {
    copyText(text)
    toast.add({ severity: 'success', summary: '提示', detail: '内容已复制到剪贴板！', life: 3000 })
  } catch (error) {
    toast.add({ severity: 'error', summary: '提示', detail: '内容复制失败！', life: 3000 })
  }
}

const onResend = (index: number) => {
  const userItem = messages.value[index - 1]
  if (userItem) {
    content.value = userItem.content
    imageParts.value = userItem.files || []
    sendConversation()
  }
}
</script>

<template>
  <div class="flex fixed w-full h-full left-0 top-0" @keydown="handleKeydown">
    <TieredMenu v-if="showMenu" ref="operatorMenu" :model="operatorItems" tabindex="" popup />
    <Toast />
    <div
      class="!lg:ml-0 ml--260px w-260px flex flex-col h-full flex-shrink-0 overflow-hidden bg-black transition-all"
      :style="{ marginLeft: sidebarVisible ? 0 : '-260px' }"
    >
      <div class="p-3 flex gap-2">
        <Button class="flex-1" icon="pi pi-plus" label="新建对话" @click="createNewChat"></Button>
      </div>
      <ScrollPanel ref="scrollPanel" class="flex-1 h-0">
        <ul class="px-3" ref="chatListsRef">
          <li
            class="text-base p-2 flex items-center gap-1 rounded cursor-pointer hover:bg-[--surface-100]"
            :class="{
              'bg-[--surface-100]': chatId === item.id,
            }"
            v-for="item in conversations"
            :key="item.id"
            @click="onselectConversation(item)"
          >
            <InputText
              v-if="item.showInput"
              ref="renameInputRef"
              type="text"
              v-model="item.title"
              size="small"
              @blur="onChangeRename"
            />
            <span v-else class="text-ellipsis overflow-hidden whitespace-nowrap">{{ item.title }}</span>
            <div
              v-if="chatId === item.id"
              class="ml-auto pi pi-ellipsis-h hover:color-[--primary-200]"
              @click="toggleMenuVisible"
            ></div>
          </li>
        </ul>
      </ScrollPanel>
      <!-- <div class="p-2 mb-2 w-full flex items-center hover:bg-[--surface-ground] rounded cursor-pointer">
        <Avatar icon="pi pi-user" shape="circle" style="background-color: #9c27b0" />
        <div class="pl-2 w-0 flex flex-col flex-1">
          <span class="block flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold">mail@gmail.com</span>
          <span class="block text-xs">剩余次数：20</span>
        </div>
      </div> -->
    </div>
    <div class="w-0 flex-1 h-full flex flex-col">
      <div class="px-3 py-2 flex gap-2">
        <Button
          v-if="sidebarVisible"
          class="lg:hidden"
          icon="pi pi-times"
          text
          @click="sidebarVisible = false"
        ></Button>
        <Button v-else class="lg:hidden" icon="pi pi-bars" text @click="sidebarVisible = true"></Button>
        <Button icon="pi pi-cog" text aria-label="设置" title="设置" @click="configVisible = true"></Button>
        <Button icon="pi pi-file-export" text aria-label="导出PDF" title="导出PDF" @click="onExportPDF"></Button>
      </div>
      <ScrollPanel ref="chatWrap" class="flex-1 h-0">
        <template v-for="(item, index) in messages">
          <div v-if="item.role === 'user'" :key="index" class="flex gap-4 mx-auto px-3 py-2 lg:max-w-3xl xl:max-w-4xl">
            <div class="w-8 h-8 shrink-0 bg-blue rounded">
              <img class="block w-full h-full" src="./assets/chatbot.svg" />
            </div>
            <div class="text-base whitespace-pre-wrap">
              {{ item.content }}
              <div v-if="item.files?.length" class="flex gap-2 py-2 flex-wrap">
                <Image
                  v-for="(list, idx) in item.files"
                  :key="idx"
                  :src="`data:${list.mimeType};base64,${list.data}`"
                  image-class="block w-40 h-40 object-cover"
                  preview
                />
              </div>
            </div>
          </div>
          <div v-if="item.role === 'assistant'" :key="index" class="mb-2 mx-auto p-3 lg:max-w-3xl xl:max-w-4xl">
            <div class="flex gap-4">
              <div v-if="item.type === 'gemini'" class="w-8 h-8 flex shrink-0 bg-white rounded">
                <img class="block m-auto w-80% h-80%" src="./assets/gemini.gif" />
              </div>
              <div v-else class="w-8 h-8 flex shrink-0 bg-[--primary-color] rounded">
                <img class="block m-auto w-80% h-80%" src="./assets/openai.svg" />
              </div>
              <Viewer :value="item.content" :plugins="plugins"></Viewer>
            </div>
            <div v-if="index !== messages.length - 1 || !chatting" class="pl-12 pt-1">
              <Button
                icon="pi pi-copy"
                text
                severity="secondary"
                class="p-2 w-auto aspect-square"
                @click="onCopyContent(item.content)"
              ></Button>
              <Button
                icon="pi pi-replay"
                text
                severity="secondary"
                class="p-2 w-auto aspect-square"
                @click="onResend(index)"
              ></Button>
            </div>
          </div>
        </template>
        <div ref="bottomLine"></div>
      </ScrollPanel>
      <div v-if="imageParts.length > 0" class="px-3 py-2 flex gap-4 items-end w-full mx-auto lg:max-w-3xl xl:max-w-4xl">
        <div class="relative w-20 h-20" v-for="(item, index) in imageParts">
          <div
            class="absolute z-9999 p-3px rounded-full right-0 translate-x-1/2 translate-y--1/2 top-0 bg-[--surface-100] cursor-pointer"
            @click="onDeleteImg(index)"
          >
            <i class="!block font-size-3 pi pi-times"></i>
          </div>
          <Image
            :src="`data:${item.mimeType};base64,${item.data}`"
            image-class="block w-20 h-20 object-cover"
            preview
          />
        </div>
      </div>
      <div class="px-3 py-2 flex gap-2 items-end w-full mx-auto lg:max-w-3xl xl:max-w-4xl">
        <template v-if="apiModel === 'gemini-pro-vision'">
          <Button icon="pi pi-images" outlined @click="onSelectFile"></Button>
          <input class="hidden" ref="inputFileRef" type="file" accept="image/*" multiple @change="onFileChange" />
        </template>
        <!-- <Button
          icon="pi pi-microphone"
          text
          severity="secondary"
          iconClass="font-size-5"
          @click="onSpeechRecord"
        ></Button> -->
        <Textarea
          class="w-full max-h-200px !overflow-y-auto"
          v-model="content"
          autoResize
          rows="1"
          placeholder="请输入...（⇧⏎换行）"
        ></Textarea>
        <Button v-if="chatting" icon="pi pi-stop-circle" @click="abortConversation"></Button>
        <Button v-else icon="pi pi-send" @click="sendConversation"></Button>
      </div>
    </div>
    <ConfigDialog ref="configRef" v-model:visible="configVisible"></ConfigDialog>
  </div>
</template>

<style scoped></style>
