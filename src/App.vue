<script setup lang="ts">
import Button from 'primevue/button'
// import Avatar from 'primevue/avatar'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Dropdown from 'primevue/dropdown'
import ScrollPanel from 'primevue/scrollpanel'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import TieredMenu from 'primevue/tieredmenu'
import { ref, onMounted, nextTick } from 'vue'
// @ts-ignore
import { Viewer } from '@bytemd/vue-next'
import highlight from '@bytemd/plugin-highlight'
import gfm from '@bytemd/plugin-gfm'
import math from '@bytemd/plugin-math'
import 'highlight.js/styles/vs2015.css'
import './markdown.css'
import copyIcon from './assets/copy.svg?raw'
import copiedIcon from './assets/copied.svg?raw'
import { copyText } from './utils'

const toast = useToast()
const content = ref('')
const configVisible = ref(false)
const apiUrl = ref(localStorage.getItem('apiUrl') ?? 'https://api.openai.com/v1/chat/completions')
const apiKey = ref(localStorage.getItem('apiKey') ?? '')
const models = ref([
  {
    name: 'gpt-3.5-turbo',
    code: 'gpt-3.5-turbo',
  },
  {
    name: 'gpt-3.5-turbo-16k',
    code: 'gpt-3.5-turbo-16k',
  },
  {
    name: 'gpt-3.5-turbo-1106',
    code: 'gpt-3.5-turbo-1106',
  },
  {
    name: 'gpt-4',
    code: 'gpt-4',
  },
  {
    name: 'gpt-4-32k',
    code: 'gpt-4-32k',
  },
  {
    name: 'gpt-4-1106-preview',
    code: 'gpt-4-1106-preview',
  },
  {
    name: 'gpt-4-vision-preview',
    code: 'gpt-4-vision-preview',
  },
])
const apiModel = ref(localStorage.getItem('apiModel') ?? 'gpt-3.5-turbo')
const messages = ref<
  {
    role: 'user' | 'assistant'
    content: string
  }[]
>([])
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

// 关闭弹窗，去除输入前后空格，保存到本地
const onConfigVisibleChange = () => {
  apiUrl.value = apiUrl.value.trim()
  apiKey.value = apiKey.value.trim()
  localStorage.setItem('apiUrl', apiUrl.value)
  localStorage.setItem('apiKey', apiKey.value)
  localStorage.setItem('apiModel', apiModel.value)
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
let requestId = ''
const sendConversation = async () => {
  if (chatting.value) {
    return
  }
  chatting.value = true
  messages.value.push({
    role: 'user',
    content: content.value,
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
  content.value = ''
  const sends = messages.value.slice(-9) // 发送4条历史
  let received = ''
  let blink = '<span class="blink">|</span>'
  messages.value.push({
    role: 'assistant',
    content: blink,
  })
  requestId = apiUrl.value + '?t=' + Date.now()
  window.netApi
    .request(
      apiUrl.value,
      {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: sends,
          stream: true,
        }),
        headers: {
          Authorization: 'Bearer ' + apiKey.value,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
        requestId,
      },
      (data) => {
        if (data.done) {
          return
        }
        data.value.split('data:').forEach((item) => {
          const str = item.trim()
          if (!str) {
            return
          }
          if (str === '[DONE]') {
            messages.value[messages.value.length - 1].content = received
            window.db.updateConversation({
              id: chatId.value,
              conversations: JSON.stringify(messages.value),
            })
            chatting.value = false
            return
          }
          received += JSON.parse(str).choices[0].delta?.content || ''
          messages.value[messages.value.length - 1].content = received + blink
        })
      }
    )
    .then((res) => {
      if (res?.error) {
        toast.add({ severity: 'error', summary: '提示', detail: res.error.message, life: 5000 })
      }
    })
}

// 停止聊天输出
const abortConversation = () => {
  window.netApi.abort(requestId)
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
</script>

<template>
  <div class="flex h-full" @keydown="handleKeydown">
    <TieredMenu v-if="showMenu" ref="operatorMenu" :model="operatorItems" popup />
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
    <div class="w-full h-full flex flex-col">
      <div class="px-3 py-2 flex gap-2">
        <Button
          v-if="sidebarVisible"
          class="lg:hidden"
          icon="pi pi-times"
          text
          @click="sidebarVisible = false"
        ></Button>
        <Button v-else class="lg:hidden" icon="pi pi-bars" text @click="sidebarVisible = true"></Button>
        <Button icon="pi pi-cog" text aria-label="设置" @click="configVisible = true"></Button>
      </div>
      <ScrollPanel class="flex-1 h-0">
        <template v-for="(item, index) in messages">
          <div v-if="item.role === 'user'" :key="index" class="flex gap-4 mx-auto px-3 py-2 lg:max-w-3xl xl:max-w-4xl">
            <div class="w-8 h-8 shrink-0 bg-blue rounded">
              <img class="block w-full h-full" src="./assets/chatbot.svg" />
            </div>
            <div class="text-base">{{ item.content }}</div>
          </div>
          <div v-if="item.role === 'assistant'" :key="index" class="mb-6 mx-auto p-3 lg:max-w-3xl xl:max-w-4xl">
            <div class="flex gap-4">
              <div class="w-8 h-8 flex shrink-0 bg-[--primary-color] rounded">
                <img class="block m-auto w-80% h-80%" src="./assets/openai.svg" />
              </div>
              <Viewer :value="item.content" :plugins="plugins"></Viewer>
            </div>
          </div>
        </template>
      </ScrollPanel>
      <div class="px-3 py-2 flex gap-2 items-end w-full mx-auto lg:max-w-3xl xl:max-w-4xl">
        <Textarea
          class="w-full max-h-200px !overflow-y-auto"
          v-model="content"
          autoResize
          rows="1"
          placeholder="请输入...（⇧⏎换行）"
        ></Textarea>
        <Button v-if="chatting" icon="pi pi-stop" @click="abortConversation"></Button>
        <Button v-else icon="pi pi-send" @click="sendConversation"></Button>
      </div>
    </div>
    <Dialog
      v-model:visible="configVisible"
      modal
      header="设置"
      class="xl:w-2xl"
      :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
      @hide="onConfigVisibleChange"
    >
      <div>
        <div class="py-1 text-sm font-medium">API URL</div>
        <InputText class="w-full" type="text" v-model.trim="apiUrl" />
      </div>
      <div class="mt-4">
        <div class="py-1 text-sm font-medium">API 密钥</div>
        <Password class="w-full" :inputStyle="{ width: '100%' }" v-model.trim="apiKey" :feedback="false" toggleMask />
      </div>
      <div class="mt-4">
        <div class="py-1 text-sm font-medium">API 模型</div>
        <Dropdown class="w-full" v-model="apiModel" :options="models" optionLabel="name" optionValue="code" />
      </div>
    </Dialog>
  </div>
</template>

<style scoped></style>
