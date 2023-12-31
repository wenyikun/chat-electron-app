<script setup lang="ts">
import { computed, ref } from 'vue'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import localforage from 'localforage'

const emit = defineEmits(['update:visible'])
const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})
const configVisible = computed({
  get() {
    return props.visible
  },
  set(v) {
    emit('update:visible', v)
  },
})
const types = ref([
  {
    name: 'OpenAI',
    code: 'openai',
  },
  {
    name: 'Gemini',
    code: 'gemini',
  },
])
const apiType = ref('openai')
const apiHost = ref('https://openhi.deno.dev')
const apiKey = ref('')
const models = ref<{ name: string; code: string }[]>([])
const apiModel = ref('gpt-3.5-turbo')

const initConfig = async () => {
  const type = apiType.value
  if (type === 'openai') {
    models.value = [
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
    ]
    // https://api.openai.com
    Promise.all([
      localforage.getItem<string>(type + '_apiHost'),
      localforage.getItem<string>(type + '_apiKey'),
      localforage.getItem<string>(type + '_apiModel'),
    ]).then(([host, key, model]) => {
      apiHost.value = host ?? 'https://openhi.deno.dev'
      apiKey.value = key ?? ''
      apiModel.value = model ?? 'gpt-3.5-turbo'
    })
  } else if (type === 'gemini') {
    models.value = [
      {
        name: 'gemini-pro',
        code: 'gemini-pro',
      },
      {
        name: 'gemini-pro-vision',
        code: 'gemini-pro-vision',
      },
    ]
    Promise.all([
      localforage.getItem<string>(type + '_apiHost'),
      localforage.getItem<string>(type + '_apiKey'),
      localforage.getItem<string>(type + '_apiModel'),
    ]).then(([host, key, model]) => {
      apiHost.value = host ?? 'https://playai.deno.dev'
      apiKey.value = key ?? ''
      apiModel.value = model ?? 'gemini-pro'
    })
  }
}

// 关闭弹窗，去除输入前后空格，保存到本地
const onConfigVisibleChange = () => {
  const type = apiType.value
  apiHost.value = apiHost.value.trim()
  apiKey.value = apiKey.value.trim()
  localforage.setItem('apiType', apiType.value)
  localforage.setItem(type + '_apiHost', apiHost.value)
  localforage.setItem(type + '_apiKey', apiKey.value)
  localforage.setItem(type + '_apiModel', apiModel.value)
}

localforage.getItem<string>('apiType').then((type) => {
  apiType.value = type ?? 'openai'
  initConfig()
})

defineExpose({
  apiType,
  apiHost,
  apiKey,
  apiModel,
  getConfig() {
    return {
      apiType: apiType.value,
      apiHost: apiHost.value,
      apiKey: apiKey.value,
      apiModel: apiModel.value,
    }
  },
})
</script>

<template>
  <Dialog v-model:visible="configVisible" modal header="设置" class="xl:w-2xl"
    :breakpoints="{ '1199px': '75vw', '575px': '90vw' }" @hide="onConfigVisibleChange">
    <div>
      <div class="py-1 text-sm font-medium">AI 服务商</div>
      <Dropdown class="w-full" v-model="apiType" :options="types" optionLabel="name" optionValue="code" @change="initConfig"/>
    </div>
    <div class="mt-4">
      <div class="py-1 text-sm font-medium">API HOST</div>
      <InputText class="w-full" type="text" v-model="apiHost" />
    </div>
    <div class="mt-4">
      <div class="py-1 text-sm font-medium">API 密钥</div>
      <Password class="w-full" :inputStyle="{ width: '100%' }" v-model="apiKey" :feedback="false" toggleMask />
    </div>
    <div class="mt-4">
      <div class="py-1 text-sm font-medium">API 模型</div>
      <Dropdown class="w-full" v-model="apiModel" :options="models" optionLabel="name" optionValue="code" />
    </div>
  </Dialog>
</template>
