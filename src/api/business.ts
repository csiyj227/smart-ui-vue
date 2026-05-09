import request from '@/utils/request'
import type {
  R,
  PageResult,
  SysFile,
  SysFileChunk,
  SysJob,
  SysJobLog,
} from '@/types/api'

// ─────────── 文件管理 ───────────
export const getFilePage = (params: any) =>
  request.get<R<PageResult<SysFile>>>('/system/file/page', { params })
export const getFileRecyclePage = (params: any) =>
  request.get<R<PageResult<SysFile>>>('/system/file/recycle/page', { params })
export const uploadFile = (formData: FormData) =>
  request.post<R<SysFile>>('/system/file/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const downloadFile = (id: number) =>
  request.get(`/system/file/download/${id}`, { responseType: 'blob' })
export const previewFileUrl = (id: number) => `/api/system/file/preview/${id}`
export const listFileVersions = (id: number) =>
  request.get<R<SysFile[]>>(`/system/file/${id}/versions`)
export const moveFileToRecycle = (id: number) =>
  request.delete<R<void>>(`/system/file/${id}`)
export const restoreFile = (id: number) =>
  request.put<R<void>>(`/system/file/${id}/restore`)
export const purgeFile = (id: number) =>
  request.delete<R<void>>(`/system/file/${id}/purge`)

// ─────────── 分片上传 ───────────
export const initChunkUpload = (data: {
  originalName: string
  totalSize: number
  chunkSize: number
  totalChunks: number
  fileMd5?: string
}) => request.post<R<SysFileChunk>>('/system/file/chunk/init', data)

export const uploadChunkPart = (uploadId: string, chunkNo: number, formData: FormData) =>
  request.post<R<SysFileChunk>>('/system/file/chunk/upload', formData, {
    params: { uploadId, chunkNo },
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const mergeChunkUpload = (uploadId: string) =>
  request.post<R<SysFile>>('/system/file/chunk/merge', { uploadId })

// ─────────── 定时任务 ───────────
export const getJobPage = (params: any) =>
  request.get<R<PageResult<SysJob>>>('/system/job/page', { params })
export const getJobById = (jobId: number) =>
  request.get<R<SysJob>>(`/system/job/${jobId}`)
export const createJob = (data: SysJob) =>
  request.post<R<void>>('/system/job', data)
export const updateJob = (data: SysJob) =>
  request.put<R<void>>('/system/job', data)
export const deleteJob = (jobId: number) =>
  request.delete<R<void>>(`/system/job/${jobId}`)
export const pauseJob = (jobId: number) =>
  request.put<R<void>>(`/system/job/${jobId}/pause`)
export const resumeJob = (jobId: number) =>
  request.put<R<void>>(`/system/job/${jobId}/resume`)
export const runJobOnce = (jobId: number) =>
  request.post<R<void>>(`/system/job/${jobId}/run`)
export const getJobUpstreams = (jobId: number) =>
  request.get<R<number[]>>(`/system/job/${jobId}/upstreams`)
export const getJobDownstreams = (jobId: number) =>
  request.get<R<number[]>>(`/system/job/${jobId}/downstreams`)
export const setJobUpstreams = (jobId: number, upstreamIds: number[]) =>
  request.put<R<void>>(`/system/job/${jobId}/upstreams`, upstreamIds)

// ─────────── 任务日志 ───────────
export const getJobLogPage = (params: any) =>
  request.get<R<PageResult<SysJobLog>>>('/system/job/log/page', { params })
export const getJobLogById = (logId: number) =>
  request.get<R<SysJobLog>>(`/system/job/log/${logId}`)
export const cleanJobLog = (days = 30) =>
  request.delete<R<number>>('/system/job/log/clean', { params: { days } })
