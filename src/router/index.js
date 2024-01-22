import { createRouter, createWebHistory } from "vue-router";
import Arizona from "../views/Arizona.vue";
import Teton from "../views/Teton.vue";
import Home from "../views/Home.vue";
import About from "../views/About.vue";
import GalleryView from "../views/GalleryView.vue";

const routes = [
  { path: "/", component: Home },
  { path: "/arizona", component: Arizona },
  { path: "/teton", component: Teton },
  { path: "/gallery/Media", component: GalleryView },
  { path: "/About", component: About },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
