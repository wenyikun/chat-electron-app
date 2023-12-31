import { createApp } from 'vue'
import 'virtual:uno.css'
import './style.css'
import 'primevue/resources/themes/lara-dark-green/theme.css'
import 'primeicons/primeicons.css'
import App from './App.vue'
import Print from './Print.vue'
import PrimeVue from 'primevue/config'
import Ripple from 'primevue/ripple'
import Tooltip from 'primevue/tooltip'
import ToastService from 'primevue/toastservice'

const app = createApp(location.hash === '#print' ? Print : App)
app.use(PrimeVue, { ripple: true })
app.directive('ripple', Ripple)
app.directive('tooltip', Tooltip)
app.use(ToastService)
app.mount('#app').$nextTick(() => {
  // Remove Preload scripts loading
  postMessage({ payload: 'removeLoading' }, '*')
})
