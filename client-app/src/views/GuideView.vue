<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <div class="mb-6">
      <router-link to="/" class="text-sm text-text-secondary hover:text-text-primary mb-2 inline-flex items-center gap-1">
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        返回服务市场
      </router-link>
      <h1 class="text-2xl font-bold mt-2">使用教程</h1>
      <p class="mt-2 text-sm text-text-secondary">三分钟上手 OpenAaaS Client：从添加服务器到拿到任务结果。</p>
    </div>

    <!-- 快速上手 -->
    <div class="bg-bg-secondary border border-border rounded-lg p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">快速上手（三步）</h2>
      <ol class="space-y-4">
        <li class="flex gap-3">
          <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white text-sm font-bold">1</span>
          <div>
            <p class="font-semibold text-sm">添加服务器</p>
            <p class="text-sm text-text-secondary mt-1">
              打开「设置」→「添加服务器」，填写别名和服务器地址。
              服务器地址：<code class="rounded bg-bg-inset border border-border px-1.5 py-0.5 text-xs text-accent">http://10.64.198.139</code>
            </p>
          </div>
        </li>
        <li class="flex gap-3">
          <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white text-sm font-bold">2</span>
          <div>
            <p class="font-semibold text-sm">统一认证登录</p>
            <p class="text-sm text-text-secondary mt-1">
              在「设置」页面对应服务器上点击「注册 / 重新登录」，输入校园统一认证账号密码。
              首次使用会自动注册，之后登录会自动重签 API Key。
            </p>
          </div>
        </li>
        <li class="flex gap-3">
          <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white text-sm font-bold">3</span>
          <div>
            <p class="font-semibold text-sm">提交任务并查看结果</p>
            <p class="text-sm text-text-secondary mt-1">
              在「服务市场」选择一个在线服务 → 查看「使用说明」了解该服务的写法要求 →
              点击「提交任务」填写任务描述和输出要求（可附文件）→
              在「任务列表」跟踪进度，完成后进入任务详情查看结果并下载输出文件。
            </p>
          </div>
        </li>
      </ol>
    </div>

    <!-- 任务管理技巧 -->
    <div class="bg-bg-secondary border border-border rounded-lg p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">任务管理技巧</h2>
      <ul class="space-y-3 text-sm text-text-secondary">
        <li class="flex gap-2">
          <span class="text-accent font-semibold flex-shrink-0">搜索</span>
          任务列表顶部支持按标题、描述、服务名搜索，并可按服务筛选、按状态过滤。
        </li>
        <li class="flex gap-2">
          <span class="text-accent font-semibold flex-shrink-0">预计耗时</span>
          进行中的任务会显示「预计总耗时」，由该服务历史任务的实际耗时估算，供安排时间参考。
        </li>
        <li class="flex gap-2">
          <span class="text-accent font-semibold flex-shrink-0">失败重试</span>
          失败或已取消的任务可在详情页点「一键重试」直接重新提交（原附件需重新添加），
          或点「修改后重新提交」调整内容后再发。
        </li>
        <li class="flex gap-2">
          <span class="text-accent font-semibold flex-shrink-0">历史清理</span>
          任务多了之后，可用列表页的「清空历史」或详情页的「删除记录」清理已结束任务。
        </li>
      </ul>
    </div>

    <!-- 常见问题 -->
    <div class="bg-bg-secondary border border-border rounded-lg p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">常见问题</h2>
      <div class="space-y-4 text-sm">
        <div>
          <p class="font-semibold">提示「认证失败 401」或「无效的 API Key」？</p>
          <p class="text-text-secondary mt-1">
            常见于服务端重启或密钥重置后。到「设置」页对对应服务器点「重新登录」即可自动重签 Key，无需其他操作。
          </p>
        </div>
        <div>
          <p class="font-semibold">输出文件下载到哪里？</p>
          <p class="text-text-secondary mt-1">
            任务详情的「结果文件」区会列出每个文件的用途说明，点击「下载」后可选择保存位置。
          </p>
        </div>
        <div>
          <p class="font-semibold">不同服务 / 不同使用方式怎么选？</p>
          <p class="text-text-secondary mt-1">
            进入服务详情页查看「使用说明」，其中包含该服务支持的模式、适用场景与耗时说明。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
