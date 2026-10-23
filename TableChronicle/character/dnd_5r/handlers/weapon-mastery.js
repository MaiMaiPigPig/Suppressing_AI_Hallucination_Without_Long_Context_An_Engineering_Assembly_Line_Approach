// ============================================================
// 武器精通处理器 - 全局作用域
// ============================================================
//
// 【这个文件有什么用？】
// 处理 "Weapon>mastery" 规则，返回一个标记结果，
// 告诉 feature-selection.js 需要弹出武器精通选择页。
//
// 规则写法：
//   Weapon>mastery
//
// 后续处理由 addPendingSelectionsFromItem 完成：
//   1. 从 item.class 拿到职业ID
//   2. 查 classes.json 拿到该职业的武器熟练范围（weapon 字段）
//   3. 查 proficiency_link → proficiency.json 拿到可选数量
//   4. 构建 pending 选择项，只显示有 mastery 属性的武器
//
// 【调用方式】
// 外部通过 index.js 的 parseRule() 自动路由过来：
//   handlers.parseRule("Weapon>mastery")
//   → 返回 { type: 'weapon_mastery', success: true, needUserSelect: true, ... }
//
// ============================================================



// ============================================================
// 函数：parse(rule)  — 解析武器精通规则
// ============================================================
// 【参数说明】
//   @param {string} rule - 规则字符串，如 "Weapon>mastery"
//
// 【返回值说明】
//   @returns {object}
//     {
//       type: 'weapon_mastery',    // 固定类型
//       success: true,
//       needUserSelect: true,      // 需要用户选择
//       count: 0,                  // 具体数量由 addPendingSelectionsFromItem 解析
//       expression: rule
//     }
//
// ============================================================
export function parse(rule) {
    rule = String(rule).trim();

    // 只匹配 "Weapon>mastery"（不区分大小写）
    var match = rule.match(/^weapon\s*>\s*mastery\s*$/i);
    if (!match) {
        return {
            type: 'weapon_mastery',
            success: false,
            needUserSelect: false,
            message: '格式错误: ' + rule
        };
    }

    return {
        type: 'weapon_mastery',
        success: true,
        needUserSelect: false,  // 不在通用路径加入待选队列，由 addPendingSelectionsFromItem 的 weapon_mastery 专有代码展开为 filter 类型
        count: 0,       // 暂时为 0，addPendingSelectionsFromItem 会通过 proficiency_link 重新计算
        expression: rule
    };
};