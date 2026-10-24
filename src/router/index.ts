import { createRouter, createWebHistory } from "vue-router";
import { track } from "../composables/useTracking";
import Home from "../views/Home.vue";

// Fixed routes first; `/:slug` picks up any collection created in /admin.
const routes = [
  { path: "/", component: Home },
  { path: "/about", component: () => import("../views/About.vue") },
  { path: "/world", component: () => import("../views/WorldGallery.vue") },
  {
    path: "/admin",
    component: () => import("../views/admin/AdminView.vue"),
    meta: { admin: true },
  },
  { path: "/:slug([a-z0-9-]+)", component: () => import("../views/CollectionView.vue") },
  { path: "/:pathMatch(.*)*", component: () => import("../views/NotFoundView.vue") },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.afterEach((to) => {
  if (!to.meta.admin) track("page_view", { path: to.path });
});

export default router;
