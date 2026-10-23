/**
 * utils/html.js
 * HTML 输出安全的公共工具。
 *
 * 角色卡、导出页、评审页都会把玩家填写的文本（姓名、背景故事、专长效果等）
 * 直接拼进 innerHTML，必须统一转义，否则玩家输入 `<script>` 之类内容会破坏页面结构。
 * 这些字符在 5 个步骤文件里各自复制了一份实现，模块化后统一收敛到这里，避免各版本转义规则漂移。
 */

/**
 * 转义文本中的 HTML 敏感字符
 * @param {*} text - 任意待转义内容，null/undefined 返回空串
 * @returns {string} 可直接安全插入 innerHTML 的字符串
 */
export function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
