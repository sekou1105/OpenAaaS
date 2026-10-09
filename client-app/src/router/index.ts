import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import ServiceDetailView from '@/views/ServiceDetailView.vue'
import SubmitTaskView from '@/views/SubmitTaskView.vue'
import TaskDetailView from '@/views/TaskDetailView.vue'
import TasksView from '@/views/TasksView.vue'
import SettingsView from '@/views/SettingsView.vue'
import GuideView from '@/views/GuideView.vue'

// meta.titleKey 为 i18n 词条 key，供窗口标题等场景按当前语言解析
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { titleKey: 'nav.home' },
    },
    {
      path: '/service/:id',
      name: 'service-detail',
      component: ServiceDetailView,
      meta: { titleKey: 'serviceDetail.title' },
    },
    {
      path: '/submit/:serviceId',
      name: 'submit-task',
      component: SubmitTaskView,
      meta: { titleKey: 'submit.title' },
    },
    {
      path: '/task/:id',
      name: 'task-detail',
      component: TaskDetailView,
      meta: { titleKey: 'taskDetail.title' },
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: TasksView,
      meta: { titleKey: 'tasks.title' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
      meta: { titleKey: 'settings.title' },
    },
    {
      path: '/guide',
      name: 'guide',
      component: GuideView,
      meta: { titleKey: 'guide.title' },
    },
  ],
})

export default router
