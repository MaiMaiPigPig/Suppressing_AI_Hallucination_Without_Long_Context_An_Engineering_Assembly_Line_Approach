// ============================================================
// code(half-prof) 半熟练处理器
// ============================================================
//
// 【作用】
// 处理 code 列标记为 "half-prof" 的数据行。
// 表示该特性授予"未熟练的项目获得一半熟练加值（向下取整）"的效果。
// 对应 D&D 5e 的"万能万用"（Jack of All Trades）特性。
//
// 【数据格式示例】
//   特征行 code = "half-prof" 时：
//   该特征行所对应的所有技能/工具等，如果角色未熟练，
//   则在检定时额外加上 熟练加值 ÷ 2（向下取整）。
//
// 【调用方式】
//   在读取数据表时，检测到 code 列值为 "half-prof"，
//   调用 CodeHandlers.execute('half-prof', rowData, context)
//
// 【返回值】
//   返回半熟练修饰器对象：
//   {
//     type: 'half-prof',
//     halfProficiency: true,    // 标记启用半熟练
//     roundDown: true,          // 向下取整
//     categories: [...]         // 空=全部，非空=限定类别
//   }

(function() {

    // ============================================================
    // 主处理函数
    // ============================================================
    function handleHalfProf(rowData, context) {
        // 检查是否有指定类别限制（如只对技能生效）
        var categories = [];
        if (rowData.rules) {
            // 支持 half-prof(skill) 或 half-prof(skill,tool) 格式
            var match = String(rowData.rules).match(/half-prof\s*\(\s*([^)]+)\s*\)/i);
            if (match) {
                categories = match[1].split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
            }
        }

        return {
            type: 'half-prof',
            title: '半熟练：' + (rowData.name || '未熟练项获一半熟练加值'),
            halfProficiency: true,       // 启用半熟练
            roundDown: true,             // 向下取整
            categories: categories,      // 空=全部类别，非空=限定类别
            desc: rowData.desc || '',
            rowData: rowData,
            context: context
        };
    }

    // ============================================================
    // 注册到全局注册表
    // ============================================================
    if (window.CodeHandlers) {
        CodeHandlers.register('half-prof', handleHalfProf);
        console.log('code-handler 已注册: half-prof');
    }
})();