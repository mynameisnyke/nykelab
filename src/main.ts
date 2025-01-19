import { createApp, ref } from "vue";
import App from "./App.vue";
import router from "./router";
import Header from "./components/ui/Header.vue";
import "./index.css";
// import function to register Swiper custom elements
import { register } from "swiper/element/bundle";
// register Swiper custom elements
register();

const app = createApp(App);

app.use(router).component("app-nav", Header).mount("#app");
