// ============================================================
// code(choose) 选择处理器
// ============================================================
//
// 【作用】
// 处理 code 列标记为 "choose(ID1,ID2,...)" 的数据行。
// 按 ID 从数据表中加载条目作为选项，让用户选择。
//
// 【数据格式示例】
//   code: "code(choose(471,472))"
//   条目 471: { name: "保护者Protector", desc: "..." }
//   条目 472: { name: "奇术使Thaumaturge", desc: "..." }
//           ↓ 合并后
//   选项1: { label: "保护者Protector", desc: "...", rules: "..." }
//   选项2: { label: "奇术使Thaumaturge", desc: "...", rules: "..." }
//
// 【调用方式】
//   在读取数据表时，检测到 code 列值为 "choose(471,472)"，
//   调用 CodeHandlers.execute('choose', rowData, context)
//
// 【返回值】
//   返回选项数组，每个选项包含：
//   { index, label, desc, rules, data: { 整条条目 } }
//   调用方（UI 层）负责展示选项并让用户选择。

(function() {
    // ============================================================
    // 从 dataCache 中按 ID 查找条目
    // 搜索所有特性数据表，找到第一个匹配 ID 的条目
    // ============================================================
    function findEntryById(id) {
        if (typeof dataCache === 'undefined') return null;
        var tables = [
            dataCache.raceFeatures,
            dataCache.classFeatures,
            dataCache.feats,
            dataCache.backgrounds
        ];
        for (var t = 0; t < tables.length; t++) {
            if (!tables[t] || !Array.isArray(tables[t])) continue;
            for (var i = 0; i < tables[t].length; i++) {
                if (tables[t][i] && tables[t][i].id === id) {
                    return tables[t][i];
                }
            }
        }
        return null;
    }

    // ============================================================
    // 从 code 字段中解析 choose(ID1,ID2,...) 格式
    // 输入: "code(choose(471,472))" 或 "code(choose(471, 472))"
    // 输出: [471, 472]
    // ============================================================
    function parseChooseIds(codeField) {
        if (!codeField) return null;
        var match = codeField.match(/choose\s*[（(]\s*([\d,\s]+)\s*[）)]/i);
        if (!match) return null;
        var ids = [];
        var parts = match[1].split(',');
        for (var i = 0; i < parts.length; i++) {
            var num = parseInt(parts[i].trim(), 10);
            if (!isNaN(num)) ids.push(num);
        }
        return ids.length > 0 ? ids : null;
    }

    // ============================================================
    // 根据 ID 列表构建选项数组
    // 加载每条条目，提取 name → label, desc → desc, rules → rules
    // ============================================================
    function buildOptionsFromIds(ids) {
        var options = [];
        for (var i = 0; i < ids.length; i++) {
            var entry = findEntryById(ids[i]);
            if (!entry) {
                console.warn('[choose] 未找到ID=' + ids[i] + ' 的条目');
                continue;
            }
            options.push({
                index: i + 1,
                marker: '',
                label: entry.name || ('选项 ' + (i + 1)),
                desc: entry.desc || '',
                rules: entry.rules || '',
                data: entry
            });
        }
        return options.length >= 2 ? options : null;
    }

    // ============================================================
    // 主处理函数
    // 解析 code 字段中的 choose(ID1,ID2,...)，加载选项
    // ============================================================
    function handleChoose(rowData, context) {
        // 从 code 字段解析 choose(ID1,ID2,...)
        var ids = parseChooseIds(rowData.code || '');
        var options = ids ? buildOptionsFromIds(ids) : null;

        if (!options) {
            console.warn('[choose] 选项不足', rowData.name || rowData.id);
            return null;
        }

        return {
            type: 'choose',
            title: '请选择：' + (rowData.name || ''),
            options: options,
            count: 1,
            rowData: rowData,
            context: context
        };
    }

    // ============================================================
    // 特性总览专用处理器（choose-review）
    // 在 handleChoose 的基础上包装，返回前端特性选择页可用的格式
    // ============================================================
    function handleChooseReview(rowData, context) {
        var baseResult = handleChoose(rowData, context);
        if (!baseResult) return null;

        return {
            type: 'code_choose',
            code: 'choose',
            success: true,
            needUserSelect: true,
            count: baseResult.count || 1,
            title: baseResult.title || '请选择：' + (rowData.name || ''),
            category: 'code_choose',
            codeName: rowData.name || 'choose',
            options: baseResult.options,
            candidates: baseResult.options.map(function(opt, i) {
                return {
                    id: 'code_opt_' + opt.index,
                    name: opt.label || opt.desc || ('选项 ' + (i + 1)),
                    desc: opt.desc || '',
                    fulldesc: opt.desc || '',
                    _rules: opt.rules || '',
                    _data: opt.data || {},
                    _optIndex: opt.index,
                    _marker: opt.marker || ''
                };
            }),
            expression: 'code(choose)',
            rowData: rowData,
            context: context
        };
    }

    // ============================================================
    // 注册到全局注册表
    // ============================================================
    if (window.CodeHandlers) {
        CodeHandlers.register('choose', handleChoose);
        CodeHandlers.register('choose-review', handleChooseReview);
        console.log('code-handler 已注册: choose, choose-review');
    }
})();