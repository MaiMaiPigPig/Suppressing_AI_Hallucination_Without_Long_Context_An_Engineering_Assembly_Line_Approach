/**
 * creation/ui/progress-bar.js
 * 进度条更新 + 步骤标签更新
 *
 * 注意：updateProgress 和 updateStepLabel 已在 flow/navigation.js 中实现，
 * 因为导航和进度条高度耦合。本文件保留以符合设计文档结构，实际导出 navigation.js 中的函数。
 */

export { updateProgress, updateStepLabel } from '../flow/navigation.js';