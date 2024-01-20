import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import router from "./router";
import Header from "./components/ui/Header.vue";
import MediaSection from "./components/ui/MediaSection.vue";
import MediaRow from "./components/ui/MediaRow.vue";
import "./index.css";
// import function to register Swiper custom elements
import { register } from "swiper/element/bundle";
// register Swiper custom elements
register();

const app = createApp(App);

app
  .use(router)
  .component("app-nav", Header)
  .component("media-section", MediaSection)
  .component("media-row", MediaRow)
  .mount("#app");
