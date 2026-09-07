import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore, type Task } from '../task'

vi.mock('@/stores/persist', () => ({
  loadState: vi.fn(() => ({
    tasks: [],
    servers: [],
  })),
  saveState: vi.fn(),
}))

vi.mock('@/composables/useHttp', () => ({
  httpFetch: vi.fn(),
  httpFetchWithRedirect: vi.fn(),
  uploadWithFiles: vi.fn(),
  parseServerError: vi.fn(),
}))

import { httpFetch, httpFetchWithRedirect, uploadWithFiles } from '@/composables/useHttp'

const mockedHttpFetch = vi.mocked(httpFetch)
const mockedHttpFetchWithRedirect = vi.mocked(httpFetchWithRedirect)
const mockedUploadWithFiles = vi.mocked(uploadWithFiles)

describe('useTaskStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    mockedHttpFetch.mockReset()
    mockedHttpFetchWithRedirect.mockReset()
    mockedUploadWithFiles.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  function createSampleTask(overrides: Partial<Task> = {}): Task {
    return {
      id: 't1',
      serverAlias: 's1',
      serviceId: 'svc1',
      serviceName: 'Svc',
      title: 'Task',
      taskPrompt: 'prompt',
      outputPrompt: 'output',
      status: 'pending',
      createdAt: new Date().toISOString(),
      files: [],
      isPolling: false,
      ...overrides,
    }
  }

  it('should have empty initial state', () => {
    const store = useTaskStore()
    expect(store.tasks).toEqual([])
    expect(store.activeTasks).toEqual([])
    expect(store.activeTaskCount).toBe(0)
    expect(store.isSubmitting).toBe(false)
    expect(store.submitError).toBeNull()
  })

  it('should get and update task', () => {
    const store = useTaskStore()
    store.tasks = [createSampleTask({ id: 't1', title: 'Original' })]
    expect(store.getTask('t1')?.title).toBe('Original')
    store.updateTask('t1', { title: 'Updated' })
    expect(store.getTask('t1')?.title).toBe('Updated')
  })

  it('should compute active tasks correctly', () => {
    const store = useTaskStore()
    store.tasks = [
      createSampleTask({ id: 't1', status: 'pending' }),
      createSampleTask({ id: 't2', status: 'completed' }),
      createSampleTask({ id: 't3', status: 'running' }),
      createSampleTask({ id: 't4', status: 'failed' }),
      createSampleTask({ id: 't5', status: 'cancelling' }),
    ]
    expect(store.activeTasks).toHaveLength(2)
    expect(store.activeTaskCount).toBe(2)
  })

  it('should remove task and stop polling', () => {
    const store = useTaskStore()
    store.tasks = [createSampleTask({ id: 't1', isPolling: true })]
    store.removeTask('t1')
    expect(store.getTask('t1')).toBeUndefined()
    expect(store.tasks).toHaveLength(0)
  })

  it('should submit task and add to list', async () => {
    const store = useTaskStore()
    const { loadState } = await import('@/stores/persist')
    vi.mocked(loadState).mockReturnValue({
      servers: [
        { alias: 's1', serverUrl: 'http://s1/', apiKey: 'ak' },
      ],
    })

    mockedUploadWithFiles.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'new-task',
        status: 'pending',
        created_at: '2024-01-01T00:00:00Z',
      }),
    } as Response)

    const taskId = await store.submitTask({
      serverAlias: 's1',
      serviceId: 'svc1',
      serviceName: 'Svc',
      title: 'My Task',
      taskPrompt: 'do it',
      outputPrompt: 'result',
    })

    expect(taskId).toBe('new-task')
    expect(store.tasks).toHaveLength(1)
    expect(store.tasks[0].title).toBe('My Task')
    expect(store.isSubmitting).toBe(false)
  })

  it('should set submitError on failed submit', async () => {
    const store = useTaskStore()
    const { loadState } = await import('@/stores/persist')
    vi.mocked(loadState).mockReturnValue({
      servers: [
        { alias: 's1', serverUrl: 'http://s1/', apiKey: 'ak' },
      ],
    })

    mockedUploadWithFiles.mockResolvedValue({
      ok: false,
      text: async () => 'error',
    } as Response)

    await expect(
      store.submitTask({
        serverAlias: 's1',
        serviceId: 'svc1',
        serviceName: 'Svc',
        title: 'T',
        taskPrompt: 'p',
        outputPrompt: 'o',
      }),
    ).rejects.toThrow('提交任务失败')
    expect(store.submitError).toContain('提交任务失败')
  })

  it('should cancel task', async () => {
    const store = useTaskStore()
    store.tasks = [createSampleTask({ id: 't1', status: 'running', isPolling: true })]
    const { loadState } = await import('@/stores/persist')
    vi.mocked(loadState).mockReturnValue({
      servers: [
        { alias: 's1', serverUrl: 'http://s1/', apiKey: 'ak' },
      ],
    })

    mockedHttpFetchWithRedirect.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'cancelled', completed_at: '2024-01-01T00:00:00Z' }),
    } as Response)

    await store.cancelTask('t1')
    expect(store.getTask('t1')?.status).toBe('cancelled')
    expect(store.getTask('t1')?.isPolling).toBe(false)
  })

  it('should start and stop polling', () => {
    const store = useTaskStore()
    store.tasks = [createSampleTask({ id: 't1', status: 'pending' })]
    store.startPolling('t1')
    expect(store.getTask('t1')?.isPolling).toBe(true)
    store.stopPolling('t1')
    expect(store.getTask('t1')?.isPolling).toBe(false)
  })

  it('should resume polling for active tasks', () => {
    const store = useTaskStore()
    store.tasks = [
      createSampleTask({ id: 't1', status: 'pending', isPolling: false }),
      createSampleTask({ id: 't2', status: 'completed', isPolling: false }),
    ]
    store.resumePolling()
    expect(store.getTask('t1')?.isPolling).toBe(true)
    expect(store.getTask('t2')?.isPolling).toBe(false)
  })

  it('should retry a failed task by re-submitting with same params', async () => {
    const store = useTaskStore()
    store.tasks = [
      createSampleTask({
        id: 't1',
        status: 'failed',
        title: '失败任务',
        taskPrompt: '原描述',
        outputPrompt: '原输出要求',
      }),
    ]
    const { loadState } = await import('@/stores/persist')
    vi.mocked(loadState).mockReturnValue({
      servers: [
        { alias: 's1', serverUrl: 'http://s1/', apiKey: 'ak' },
      ],
    })

    mockedUploadWithFiles.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'retry-task',
        status: 'pending',
        created_at: '2024-01-01T00:00:00Z',
      }),
    } as Response)

    const newTaskId = await store.retryTask('t1')
    expect(newTaskId).toBe('retry-task')
    expect(store.tasks).toHaveLength(2)
    const newTask = store.getTask('retry-task')
    expect(newTask?.title).toBe('失败任务')
    expect(newTask?.taskPrompt).toBe('原描述')
    expect(newTask?.outputPrompt).toBe('原输出要求')
    expect(newTask?.status).toBe('pending')
  })

  it('should reject retry for non-existent or active task', async () => {
    const store = useTaskStore()
    store.tasks = [createSampleTask({ id: 't1', status: 'running' })]
    await expect(store.retryTask('missing')).rejects.toThrow('任务不存在')
    await expect(store.retryTask('t1')).rejects.toThrow('任务尚未结束')
  })

  it('should clear only finished tasks and keep active ones', () => {
    const store = useTaskStore()
    store.tasks = [
      createSampleTask({ id: 't1', status: 'completed' }),
      createSampleTask({ id: 't2', status: 'failed' }),
      createSampleTask({ id: 't3', status: 'cancelled' }),
      createSampleTask({ id: 't4', status: 'running', isPolling: false }),
      createSampleTask({ id: 't5', status: 'pending', isPolling: false }),
    ]
    const removed = store.clearFinishedTasks()
    expect(removed).toBe(3)
    expect(store.tasks.map((t) => t.id)).toEqual(['t4', 't5'])
  })

  it('should return 0 when nothing to clear', () => {
    const store = useTaskStore()
    store.tasks = [createSampleTask({ id: 't1', status: 'running' })]
    expect(store.clearFinishedTasks()).toBe(0)
    expect(store.tasks).toHaveLength(1)
  })

  it('should submit follow-up task with session_id and store it', async () => {
    const store = useTaskStore()
    const { loadState } = await import('@/stores/persist')
    vi.mocked(loadState).mockReturnValue({
      servers: [
        { alias: 's1', serverUrl: 'http://s1/', apiKey: 'ak' },
      ],
    })

    mockedUploadWithFiles.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'follow-task',
        status: 'pending',
        created_at: '2024-01-01T00:00:00Z',
        session_id: 'sess-1',
      }),
    } as Response)

    const taskId = await store.submitTask({
      serverAlias: 's1',
      serviceId: 'svc1',
      serviceName: 'Svc',
      title: '（追问）T',
      taskPrompt: 'p',
      outputPrompt: 'o',
      sessionId: 'sess-1',
    })

    expect(taskId).toBe('follow-task')
    // 提交时 multipart 字段携带 session_id
    const fields = mockedUploadWithFiles.mock.calls[0][1] as Record<string, string>
    expect(fields.session_id).toBe('sess-1')
    // 任务本地持久化 sessionId（以服务端返回为准）
    expect(store.getTask('follow-task')?.sessionId).toBe('sess-1')
  })

  it('should estimate duration from same-service completed history', () => {
    const store = useTaskStore()
    const base = Date.now()
    const mkCompleted = (id: string, serviceId: string, durationSec: number): Task =>
      createSampleTask({
        id,
        serviceId,
        status: 'completed',
        createdAt: new Date(base - 86400000).toISOString(),
        startedAt: new Date(base - 86400000).toISOString(),
        completedAt: new Date(base - 86400000 + durationSec * 1000).toISOString(),
      })
    store.tasks = [
      mkCompleted('t1', 'svc1', 600),
      mkCompleted('t2', 'svc1', 1200),
      mkCompleted('t3', 'svc2', 9999),
      createSampleTask({ id: 't4', serviceId: 'svc1', status: 'running' }),
    ]

    const est = store.estimateServiceDuration('svc1')
    expect(est?.sampleCount).toBe(2)
    expect(est?.avgSeconds).toBe(900)
    expect(store.estimateServiceDuration('svc-none')).toBeNull()
  })
})
