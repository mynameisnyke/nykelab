import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";

const routes = [
  { path: "/", component: Home },
  { path: "/Blog", component: Home },
  { path: "/Gallery", component: Home },
  { path: "/About", component: Home },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
