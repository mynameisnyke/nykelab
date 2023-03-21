import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import router from "./router";
import "./index.css";

createApp(App).use(router).mount("#app");
