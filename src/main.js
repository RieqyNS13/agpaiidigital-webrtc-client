import Vue from 'vue'
import App from './App.vue'
import router from './router'
import { io } from "socket.io-client";

Vue.config.productionTip = false
Vue.prototype.$io = io("192.168.59.129:3000");

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
