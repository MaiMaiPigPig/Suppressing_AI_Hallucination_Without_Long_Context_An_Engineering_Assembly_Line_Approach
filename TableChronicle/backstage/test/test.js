// ============================================================
// 交互调试台
// ============================================================
//
// 【说明】
// 提供一个图形化界面，让你逐个测试 ③ 的所有可调用函数。
// 左侧列出所有 API，点击自动填充到测试区；
// 右侧选目标 → 填参数 → 点执行 → 看输出。
//
// 【不修改 ③ 任何代码】
//   所有测试通过调用 ③ 暴露的全局 API 来验证功能
//
// 【使用方法】
//   1. 点击「加载脚本」
//   2. 左侧点击某个 API 或下拉菜单选择测试目标
//   3. 填写参数
//   4. 点击「执行」
//   5. 看输出结果
// ============================================================

// ============================================================
// 脚本加载器
// ============================================================
var ScriptLoader = {
    files: [
        '/character/dnd_5r/character.js',
        '/character/dnd_5r/utils/currency.js',
        '/character/dnd_5r/handlers/basic.js',
        '/character/dnd_5r/handlers/attribute.js',
        '/character/dnd_5r/handlers/level.js',
        '/character/dnd_5r/handlers/table-ref.js',
        '/character/dnd_5r/handlers/filter.js',
        '/character/dnd_5r/handlers/operation.js',
        '/character/dnd_5r/handlers/proficiency.js',
        '/character/dnd_5r/handlers/chain.js',
        '/character/dnd_5r/handlers/selection.js',
        '/character/dnd_5r/handlers/resource.js',
        '/character/dnd_5r/handlers/choose.js',
        '/character/dnd_5r/handlers/special.js',
        '/character/dnd_5r/handlers/table-map.js',
        '/character/dnd_5r/handlers/feat-require.js',
        '/character/dnd_5r/handlers/index.js',
        '/character/dnd_5r/code-handlers/registry.js',
        '/character/dnd_5r/code-handlers/choose.js',
        '/character/dnd_5r/code-handlers/half-prof.js',
        '/character/dnd_5r/code-handlers/spell-level.js',
    ],

    loaded: {},
    loadLog: [],

    loadAll: function(callback) {
        var self = this;
        this.loadLog = [];
        this._setBadge('loading', '加载中...');

        var index = 0;
        function next() {
            if (index >= self.files.length) {
                self._setBadge('ready', '就绪 (' + self.files.length + ' 脚本)');
                self._renderLog();
                self._initDataCache();
                if (callback) callback(true);
                return;
            }
            var file = self.files[index];
            self._loadScript(file, function(success, errMsg) {
                self.loaded[file] = success;
                self.loadLog.push({
                    file: file,
                    success: success,
                    msg: errMsg || (success ? 'OK' : '失败')
                });
                index++;
                setTimeout(next, 30);
            });
        }
        next();
    },

    _loadScript: function(src, cb) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = function() { cb(true); };
        s.onerror = function() { cb(false, '加载失败'); };
        document.head.appendChild(s);
    },

    _setBadge: function(state, text) {
        var el = document.getElementById('statusBadge');
        if (!el) return;
        el.className = 'badge badge-' + state;
        el.textContent = text;
    },

    _renderLog: function() {
        var el = document.getElementById('loadLog');
        if (!el) return;
        el.innerHTML = this.loadLog.map(function(e) {
            var cls = e.success ? 'log-ok' : 'log-err';
            var name = e.file.split('/').pop();
            return '<div class="log-entry ' + cls + '">' +
                   (e.success ? '✅' : '❌') + ' ' + name +
                   (e.msg !== 'OK' ? ' — ' + e.msg : '') + '</div>';
        }).join('');
    },

    // 初始化 mock dataCache（如果角色系统没加载数据的话）
    _initDataCache: function() {
        if (typeof dataCache === 'undefined') {
            window.dataCache = {};
        }
        if (!dataCache.lookupTable) {
            dataCache.lookupTable = [
                { id: 262, source_table: 'spells', type: 'filter', target_id: 0, count: 2, complex_logic: 'class=12,school=7', desc: '防护学派' },
                { id: 263, source_table: 'spells', type: 'filter', target_id: 0, count: 2, complex_logic: 'class=12,school=9', desc: '预言学派' },
                { id: 300, source_table: 'spells', type: 'filter', target_id: 0, count: 1, complex_logic: 'class=12,school=8', desc: '咒法学派' },
                { id: 301, source_table: 'spells', type: 'filter', target_id: 0, count: 1, complex_logic: 'class=12,school=10', desc: '附魔学派' },
                { id: 302, source_table: 'spells', type: 'filter', target_id: 0, count: 1, complex_logic: 'class=12,school=11', desc: '塑能学派' },
                { id: 303, source_table: 'spells', type: 'filter', target_id: 0, count: 1, complex_logic: 'class=12,school=12', desc: '幻术学派' },
                { id: 264, source_table: 'spells', type: 'filter', target_id: 0, count: 2, complex_logic: 'class=12,school=11', desc: '塑能学者法术选2' },
                // ===== id 类型 =====
                { id: 265, source_table: 'spells', type: 'id', target_id: 56, count: 0, complex_logic: '', desc: '至圣斩(spell=56)' },
                // ===== type 类型 =====
                { id: 266, source_table: 'feats', type: 'type', target_id: 44, count: 1, complex_logic: '', desc: '起源专长 type=44' },
                { id: 267, source_table: 'tool', type: 'type', target_id: 66, count: 3, complex_logic: '', desc: '工匠工具 type=66 选3' },
                // ===== choose 类型 =====
                { id: 268, source_table: 'skills', type: 'choose', target_id: 0, count: 2, complex_logic: '11,12,18', desc: '技能ID[11,12,18] 选2' },
                // ===== special 类型 =====
                { id: 269, source_table: 'procedure', type: 'special', target_id: 0, count: 0, complex_logic: 'all', desc: '所有技能熟练' },
                { id: 270, source_table: 'procedure', type: 'special', target_id: 0, count: 3, complex_logic: 'choose(skill,tool(type=66))', desc: '技能+工具组合选3' },
                { id: 271, source_table: 'procedure', type: 'special', target_id: 0, count: 1, complex_logic: 'Proficiency>pure', desc: '技能专精' },
                { id: 272, source_table: 'procedure', type: 'special', target_id: 0, count: 0, complex_logic: 'half-prof', desc: '未熟练项半熟练' },
                { id: 273, source_table: 'spells', type: 'special', target_id: 0, count: 2, complex_logic: 'spell-level', desc: '按法术环阶选择(防护学派)' },
            ];
        }
        if (!dataCache.feats) {
            dataCache.feats = [
                { id: 41, name: '警觉', type: 44 },
                { id: 42, name: '幸运', type: 44 },
                { id: 43, name: '魔法学徒', type: 44 },
            ];
        }
        if (!dataCache.spells) {
            dataCache.spells = [
                { id: 1, name: '护盾术', school: 7, level: 1 },
                { id: 2, name: '法师护甲', school: 7, level: 1 },
                { id: 3, name: '虔诚护盾', school: 7, level: 2 },
                { id: 4, name: '防护能量', school: 7, level: 3 },
                { id: 5, name: '高等隐形', school: 12, level: 4 },
                { id: 6, name: '魔法飞弹', school: 11, level: 1 },
                { id: 7, name: '火球术', school: 11, level: 3 },
                { id: 8, name: '侦测魔法', school: 9, level: 1 },
                { id: 9, name: '鉴定术', school: 9, level: 1 },
                { id: 10, name: '通晓语言', school: 9, level: 2 },
            ];
        }
    }
};

// 全局加载函数
function loadCharacterScripts() {
    ScriptLoader.loadAll();
    // 等加载完成后刷新 API 树
    setTimeout(function() {
        renderApiTree();
    }, 500);
    setTimeout(function() {
        renderApiTree();
    }, 2000);
}

// ============================================================
// API 树定义
// ============================================================
var API_TREE = [
    {
        group: 'CodeHandlers — code 列处理系统',
        defaultOpen: true,
        items: [
            { id: 'CodeHandlers.list', label: 'CodeHandlers.list()', desc: '列出所有已注册 handler 名称', target: 'CodeHandlers.list' },
            { id: 'CodeHandlers.has', label: 'CodeHandlers.has(code)', desc: '检查某个 code 是否已注册', target: 'CodeHandlers.has' },
            { id: 'CodeHandlers.execute', label: 'CodeHandlers.execute(code, rowData, context)', desc: '核心！执行一个 code handler', target: 'CodeHandlers.execute' },
        ]
    },
    {
        group: 'code-handlers — 具体 handler 文件',
        items: [
            { id: 'choose', label: 'choose.js', desc: '① ② 标记拆分 → 多选一', target: 'CodeHandlers.execute', preset: { target: 'CodeHandlers.execute', params: { code: 'choose' } } },
            { id: 'half-prof', label: 'half-prof.js', desc: '未熟练项获得半熟练', target: 'CodeHandlers.execute', preset: { target: 'CodeHandlers.execute', params: { code: 'half-prof' } } },
            { id: 'spell-level', label: 'spell-level.js', desc: '根据角色等级/环阶过滤法术', target: 'CodeHandlers.execute', preset: { target: 'CodeHandlers.execute', params: { code: 'spell-level' } } },
        ]
    },
    {
        group: 'handlers.parseRule — 规则解析主入口',
        defaultOpen: true,
        items: [
            { id: 'handlers.parseRule', label: 'handlers.parseRule(rule)', desc: '解析单条规则字符串（自动路由到各子处理器）', target: 'handlers.parseRule' },
            { id: 'handlers.processItemRules', label: 'handlers.processItemRules(item, character)', desc: '扫描一个 JSON 条目的所有规则字段', target: 'handlers.processItemRules' },
        ]
    },
    {
        group: 'handlers.xxx.parse — 各子处理器',
        items: [
            { id: 'handlers.filter.parse', label: 'handlers.filter.parse(rule)', desc: '条件筛选：spell(...)+N', target: 'handlers.filter.parse' },
            { id: 'handlers.basic.parse', label: 'handlers.basic.parse(rule)', desc: '基础值：hp / ac= / speed+', target: 'handlers.basic.parse' },
            { id: 'handlers.attribute.parse', label: 'handlers.attribute.parse(rule)', desc: '属性调整值：AbilityModifiers(id)', target: 'handlers.attribute.parse' },
            { id: 'handlers.level.parse', label: 'handlers.level.parse(rule)', desc: '等级引用：lv:class(id)', target: 'handlers.level.parse' },
            { id: 'handlers.operation.parse', label: 'handlers.operation.parse(rule)', desc: '数值运算：skill+/工具+/language+', target: 'handlers.operation.parse' },
            { id: 'handlers.proficiency.parse', label: 'handlers.proficiency.parse(rule)', desc: '熟练转专精：Proficiency>pure', target: 'handlers.proficiency.parse' },
            { id: 'handlers.chain.parse', label: 'handlers.chain.parse(rule)', desc: '连锁引用：chain:id', target: 'handlers.chain.parse' },
            { id: 'handlers.selection.parse', label: 'handlers.selection.parse(rule)', desc: '①②选择 / 范围选择', target: 'handlers.selection.parse' },
            { id: 'handlers.resource.parse', label: 'handlers.resource.parse(rule)', desc: '角色资源：Character(资源名)', target: 'handlers.resource.parse' },
            { id: 'handlers.special.parse', label: 'handlers.special.parse(rule)', desc: '特殊标记：二选一 / 环位：+N', target: 'handlers.special.parse' },
            { id: 'handlers.tableMap.parse', label: 'handlers.tableMap.parse(rule)', desc: '表名映射', target: 'handlers.tableMap.parse' },
            { id: 'handlers.featRequire.parse', label: 'handlers.featRequire.parse(rule)', desc: '专长先决条件：lv>= / ability()>=', target: 'handlers.featRequire.parse' },
            { id: 'handlers.tableRef.parse', label: 'handlers.tableRef.parse(rule)', desc: '固定引用：spell=id', target: 'handlers.tableRef.parse' },
            { id: 'handlers.choose.parse', label: 'handlers.choose.parse(rule)', desc: '多类组合选择：choose(skill,tool)+N', target: 'handlers.choose.parse' },
            { id: 'handlers.choose.splitArgs', label: 'handlers.choose.splitArgs(str)', desc: '辅助：拆分 choose() 括号内参数', target: 'handlers.choose.splitArgs' },
        ]
    },
    {
        group: 'character / dataCache — 角色数据',
        items: [
            { id: 'dataCache', label: 'dataCache', desc: '全局数据缓存（查看内容）', target: '__free__', preset: { target: '__free__', params: { expr: 'dataCache' } } },
            { id: 'dataCache.spells', label: 'dataCache.spells', desc: '法术列表（查看内容）', target: '__free__', preset: { target: '__free__', params: { expr: 'dataCache.spells' } } },
            { id: 'dataCache.lookupTable', label: 'dataCache.lookupTable', desc: '引用表（查看内容）', target: '__free__', preset: { target: '__free__', params: { expr: 'dataCache.lookupTable' } } },
            { id: 'dataCache.feats', label: 'dataCache.feats', desc: '专长列表（查看内容）', target: '__free__', preset: { target: '__free__', params: { expr: 'dataCache.feats' } } },
        ]
    },
];

// ============================================================
// 渲染 API 树
// ============================================================
function renderApiTree() {
    var container = document.getElementById('apiTree');
    if (!container) return;

    container.innerHTML = API_TREE.map(function(group) {
        var isOpen = group.defaultOpen !== false;
        var itemsHtml = group.items.map(function(item) {
            return '<div class="api-item" onclick="onApiItemClick(\'' + item.id + '\')" title="' + (item.desc || '') + '">' +
                   '<div class="fn-name">' + item.label + '</div>' +
                   '<div class="fn-desc">' + (item.desc || '') + '</div>' +
                   '</div>';
        }).join('');

        return '<div class="api-group">' +
               '<div class="api-group-title' + (isOpen ? '' : ' collapsed') + '" onclick="toggleApiGroup(this)">' +
               '<span class="arrow">▼</span> ' + group.group +
               '</div>' +
               '<div class="api-group-body" style="display:' + (isOpen ? 'block' : 'none') + '">' +
               itemsHtml +
               '</div>' +
               '</div>';
    }).join('');
}

function toggleApiGroup(titleEl) {
    titleEl.classList.toggle('collapsed');
    var body = titleEl.nextElementSibling;
    if (body) {
        body.style.display = body.style.display === 'none' ? 'block' : 'none';
    }
}

// API 树点击 → 设置下拉菜单和参数
function onApiItemClick(itemId) {
    // 查找 item 定义
    var item = null;
    for (var g = 0; g < API_TREE.length; g++) {
        for (var i = 0; i < API_TREE[g].items.length; i++) {
            if (API_TREE[g].items[i].id === itemId) {
                item = API_TREE[g].items[i];
                break;
            }
        }
        if (item) break;
    }
    if (!item) return;

    var target = item.target;
    var select = document.getElementById('targetSelect');

    // 设置下拉菜单
    for (var oi = 0; oi < select.options.length; oi++) {
        if (select.options[oi].value === target) {
            select.selectedIndex = oi;
            break;
        }
    }

    // 切换参数区
    onTargetChange();

    // 如果有预设参数，填充
    if (item.preset) {
        var preset = item.preset.params;
        if (preset) {
            for (var key in preset) {
                var el = document.getElementById('param_' + key);
                if (el) el.value = preset[key];
            }
        }
    }
}

// ============================================================
// 目标切换 → 动态渲染参数输入区
// ============================================================
function onTargetChange() {
    var select = document.getElementById('targetSelect');
    var target = select ? select.value : '';
    var area = document.getElementById('paramArea');
    if (!area) return;

    area.innerHTML = renderParams(target);
}

function renderParams(target) {
    switch (target) {

        // --- CodeHandlers.execute ---
        case 'CodeHandlers.execute':
            return '' +
                '<div class="param-group">' +
                '  <span class="param-label">code <span class="param-hint">handler 名称，如 choose / half-prof / spell-level</span></span>' +
                '  <input type="text" id="param_code" value="choose" placeholder="choose">' +
                '</div>' +
                '<div class="param-group">' +
                '  <span class="param-label">rowData <span class="param-hint">行数据(JSON)，所有列</span></span>' +
                '  <textarea id="param_rowData" rows="3" spellcheck="false">' +
                JSON.stringify({ name: '测试', desc: '①选项一描述②选项二描述', rules: '①spell(class=12,school=7)+2②skill+1' }, null, 2) +
                '</textarea>' +
                '</div>' +
                '<div class="param-group">' +
                '  <span class="param-label">context <span class="param-hint">执行上下文(JSON)，如 { level: 3 }</span></span>' +
                '  <textarea id="param_context" rows="2" spellcheck="false">' +
                JSON.stringify({ level: 3 }, null, 2) +
                '</textarea>' +
                '</div>';

        // --- CodeHandlers.list ---
        case 'CodeHandlers.list':
            return '<div class="param-group"><span class="param-label" style="color:#8a7a6a;">无需参数，直接执行</span></div>';

        // --- CodeHandlers.has ---
        case 'CodeHandlers.has':
            return '' +
                '<div class="param-group">' +
                '  <span class="param-label">code <span class="param-hint">要检查的 handler 名称</span></span>' +
                '  <input type="text" id="param_code" value="choose" placeholder="choose">' +
                '</div>';

        // --- handlers.parseRule ---
        case 'handlers.parseRule':
            return '' +
                '<div class="param-group">' +
                '  <span class="param-label">rule <span class="param-hint">规则字符串</span></span>' +
                '  <textarea id="param_rule" rows="2" spellcheck="false">spell(class=12,school=7)+2</textarea>' +
                '</div>' +
                '<div class="param-group">' +
                '  <span class="param-label">常用示例</span>' +
                '  <div style="font-size:11px;color:#8a7a6a;display:flex;flex-wrap:wrap;gap:4px;margin-top:2px;">' +
                '    <span style="cursor:pointer;text-decoration:underline;" onclick="fillRule(\'hp\')">hp</span>' +
                '    <span style="cursor:pointer;text-decoration:underline;" onclick="fillRule(\'spell(class=12,school=7)+2\')">spell(...)+2</span>' +
                '    <span style="cursor:pointer;text-decoration:underline;" onclick="fillRule(\'skill+1\')">skill+1</span>' +
                '    <span style="cursor:pointer;text-decoration:underline;" onclick="fillRule(\'spell(class=12,lv=0)+2\')">spell(class=12,lv=0)+2</span>' +
                '    <span style="cursor:pointer;text-decoration:underline;" onclick="fillRule(\'Proficiency>pure+1\')">Proficiency>pure+1</span>' +
                '    <span style="cursor:pointer;text-decoration:underline;" onclick="fillRule(\'二选一\')">二选一</span>' +
                '    <span style="cursor:pointer;text-decoration:underline;" onclick="fillRule(\'环位：+1\')">环位：+1</span>' +
                '    <span style="cursor:pointer;text-decoration:underline;" onclick="fillRule(\'lv:class(6)\')">lv:class(6)</span>' +
                '    <span style="cursor:pointer;text-decoration:underline;" onclick="fillRule(\'AbilityModifiers(1)\')">AbilityModifiers(1)</span>' +
                '  </div>' +
                '</div>';

        // --- handlers.processItemRules ---
        case 'handlers.processItemRules':
            return '' +
                '<div class="param-group">' +
                '  <span class="param-label">item <span class="param-hint">数据条目(JSON)</span></span>' +
                '  <textarea id="param_item" rows="4" spellcheck="false">' +
                JSON.stringify({ id: 61, name: '技能', rules: 'skill+1', tool: '', code: '' }, null, 2) +
                '</textarea>' +
                '</div>' +
                '<div class="param-group">' +
                '  <span class="param-label">character <span class="param-hint">角色对象(JSON)，可为 {}</span></span>' +
                '  <textarea id="param_character" rows="2" spellcheck="false">{}</textarea>' +
                '</div>';

        // --- 各 handler.xxx.parse ---
        case 'handlers.filter.parse':
        case 'handlers.basic.parse':
        case 'handlers.attribute.parse':
        case 'handlers.level.parse':
        case 'handlers.operation.parse':
        case 'handlers.proficiency.parse':
        case 'handlers.chain.parse':
        case 'handlers.selection.parse':
        case 'handlers.resource.parse':
        case 'handlers.special.parse':
        case 'handlers.tableMap.parse':
        case 'handlers.featRequire.parse':
        case 'handlers.tableRef.parse':
        case 'handlers.choose.parse':
        case 'handlers.choose.splitArgs':
            return '' +
                '<div class="param-group">' +
                '  <span class="param-label">rule <span class="param-hint">规则字符串</span></span>' +
                '  <textarea id="param_rule" rows="2" spellcheck="false">' + getDefaultRule(target) + '</textarea>' +
                '</div>';

        // --- 自由输入 ---
        case '__free__':
            return '' +
                '<div class="param-group">' +
                '  <span class="param-label">JS 表达式 <span class="param-hint">输入任意 JS 代码，如 CodeHandlers.list()</span></span>' +
                '  <textarea id="param_expr" rows="2" spellcheck="false">CodeHandlers.list()</textarea>' +
                '</div>';

        default:
            return '<div class="param-group"><span class="param-label" style="color:#b34a4a;">未知目标: ' + target + '</span></div>';
    }
}

function getDefaultRule(target) {
    var map = {
        'handlers.filter.parse': 'spell(class=12,lv=0)+2',
        'handlers.basic.parse': 'hp',
        'handlers.attribute.parse': 'AbilityModifiers(1)',
        'handlers.level.parse': 'lv:class(6)',
        'handlers.operation.parse': 'skill+1',
        'handlers.proficiency.parse': 'Proficiency>pure+1',
        'handlers.chain.parse': 'chain:54',
        'handlers.selection.parse': '①Feats(type=44)+1,②spell(class=3,lv=0)+2',
        'handlers.resource.parse': 'Character(不屈)+1',
        'handlers.special.parse': '二选一',
        'handlers.tableMap.parse': 'class_features',
        'handlers.featRequire.parse': 'lv>=4',
        'handlers.tableRef.parse': 'spell=56',
        'handlers.choose.parse': 'choose(skill,tool(type=66))+3',
        'handlers.choose.splitArgs': 'skill,tool(type=66)',
    };
    return map[target] || '';
}

function fillRule(val) {
    var el = document.getElementById('param_rule');
    if (el) el.value = val;
}

// ============================================================
// 执行测试
// ============================================================
function executeTest() {
    var select = document.getElementById('targetSelect');
    var target = select ? select.value : '';
    var outputBody = document.getElementById('outputBody');
    var outputMeta = document.getElementById('outputMeta');

    if (!outputBody) return;

    // 检查脚本是否已加载
    var scriptsLoaded = (typeof CodeHandlers !== 'undefined');
    if (!scriptsLoaded) {
        outputMeta.textContent = '脚本未加载';
        outputBody.innerHTML = '<div class="json-output">' +
            '<div class="error-line">❌ 脚本未加载</div>' +
            '<div style="color:#d4a84b;padding:8px 0;">请先点击左上角「🔄 加载脚本」按钮，等待状态变为「就绪」后再执行。</div>' +
            '<div style="color:#8a7a6a;font-size:11px;">加载约需 1~2 秒，22 个脚本会依次注入。</div>' +
            '</div>';
        return;
    }

    var startTime = Date.now();
    var result = null;
    var error = null;
    var inputParams = captureInputParams(target);

    try {
        result = callTarget(target);
    } catch(e) {
        var stack = (e.stack || '').split('\n').slice(0, 4).join('\n');
        error = e.message || String(e);
        if (stack) error += '\n' + stack;
    }

    var elapsed = Date.now() - startTime;
    outputMeta.textContent = elapsed + 'ms | ' + target;

    // 渲染"输入条件" + "输出结果"
    var inputHtml = renderInputSummary(inputParams);
    var resultHtml = error
        ? '<div class="error-line">❌ 异常: ' + escapeHtml(error) + '</div>'
        : formatOutput(result, target);

    outputBody.innerHTML = '<div class="json-output">' +
        inputHtml +
        '<hr class="output-hr">' +
        '</div>' +
        '<div class="json-output">' +
        resultHtml +
        '</div>';
}

// ============================================================
// 调用目标函数
// ============================================================
function callTarget(target) {
    switch (target) {
        // --- CodeHandlers ---
        case 'CodeHandlers.list': {
            if (typeof CodeHandlers === 'undefined') throw new Error('CodeHandlers 未定义，请先加载脚本');
            return CodeHandlers.list();
        }
        case 'CodeHandlers.has': {
            var code = getParam('param_code');
            if (!code) throw new Error('请输入 code');
            if (typeof CodeHandlers === 'undefined') throw new Error('CodeHandlers 未定义，请先加载脚本');
            return { code: code, registered: CodeHandlers.has(code) };
        }
        case 'CodeHandlers.execute': {
            var code = getParam('param_code');
            var rowData = parseJSONParam('param_rowData', 'rowData');
            var context = parseJSONParam('param_context', 'context');
            if (!code) throw new Error('请输入 code');
            if (typeof CodeHandlers === 'undefined') throw new Error('CodeHandlers 未定义，请先加载脚本');
            return CodeHandlers.execute(code, rowData, context);
        }

        // --- handlers.parseRule ---
        case 'handlers.parseRule': {
            var rule = getParam('param_rule');
            if (!rule) throw new Error('请输入 rule');
            if (typeof handlers === 'undefined') throw new Error('handlers 未定义，请先加载脚本');
            if (typeof handlers.parseRule !== 'function') throw new Error('handlers.parseRule 不是函数');
            return handlers.parseRule(rule);
        }

        // --- handlers.processItemRules ---
        case 'handlers.processItemRules': {
            var item = parseJSONParam('param_item', 'item');
            var character = parseJSONParam('param_character', 'character');
            if (typeof handlers === 'undefined') throw new Error('handlers 未定义，请先加载脚本');
            return handlers.processItemRules(item, character);
        }

        // --- handlers.xxx.parse ---
        case 'handlers.filter.parse':
        case 'handlers.basic.parse':
        case 'handlers.attribute.parse':
        case 'handlers.level.parse':
        case 'handlers.operation.parse':
        case 'handlers.proficiency.parse':
        case 'handlers.chain.parse':
        case 'handlers.selection.parse':
        case 'handlers.resource.parse':
        case 'handlers.special.parse':
        case 'handlers.tableMap.parse':
        case 'handlers.featRequire.parse':
        case 'handlers.tableRef.parse':
        case 'handlers.choose.parse':
        case 'handlers.choose.splitArgs': {
            var parts = target.split('.');
            var obj = window;
            for (var i = 0; i < parts.length; i++) {
                obj = obj[parts[i]];
                if (typeof obj === 'undefined') throw new Error(target + ' 未定义，请先加载脚本');
            }
            if (typeof obj !== 'function') throw new Error(target + ' 不是函数');

            // 确定参数
            var arg;
            if (parts[parts.length - 1] === 'splitArgs') {
                arg = getParam('param_rule');
            } else {
                arg = getParam('param_rule');
            }
            if (!arg && arg !== '') {
                // splitArgs 允许空字符串
                throw new Error('请输入规则参数');
            }
            return obj(arg);
        }

        // --- 自由输入 ---
        case '__free__': {
            var expr = getParam('param_expr');
            if (!expr) throw new Error('请输入 JS 表达式');
            return eval(expr);
        }

        default:
            throw new Error('未知目标: ' + target);
    }
}

// ============================================================
// 辅助函数
// ============================================================
function getParam(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

function parseJSONParam(id, name) {
    var val = getParam(id);
    if (!val) return {};
    try {
        return JSON.parse(val);
    } catch(e) {
        throw new Error(name + ' JSON 格式错误: ' + e.message + '\n当前值: ' + val, { cause: e });
    }
}

// ============================================================
// 格式化输出 — 带语法高亮
// ============================================================
function formatOutput(data, target) {
    // null / undefined
    if (data === null) return '<div class="json-output"><span class="json-null">null</span></div>';
    if (data === undefined) return '<div class="json-output"><span class="json-null">undefined</span></div>';

    if (typeof data === 'string') {
        return '<div class="json-output"><span class="json-string">"' + escapeHtml(data) + '"</span></div>';
    }
    if (typeof data === 'number') {
        return '<div class="json-output"><span class="json-number">' + data + '</span></div>';
    }
    if (typeof data === 'boolean') {
        return '<div class="json-output"><span class="json-bool">' + data + '</span></div>';
    }

    // 数组或对象 — JSON 高亮
    if (typeof data === 'object') {
        // 添加摘要行
        var summary = [];
        if (Array.isArray(data)) {
            summary.push('Array[' + data.length + ']');
        } else {
            var keys = Object.keys(data);
            summary.push('Object{' + keys.length + ' keys}');
            // 显示关键字段
            var keyFields = ['type', 'success', 'needUserSelect', 'subtype', 'category', 'count', 'name', 'title'];
            var keyVals = [];
            for (var kf = 0; kf < keyFields.length; kf++) {
                if (data[keyFields[kf]] !== undefined) {
                    keyVals.push(keyFields[kf] + ': ' + JSON.stringify(data[keyFields[kf]]));
                }
            }
            if (keyVals.length > 0) {
                summary.push(keyVals.join(' | '));
            }
        }

        var jsonStr = JSON.stringify(data, null, 2);
        var highlighted = syntaxHighlight(jsonStr);
        return '<div class="json-output">' +
               '<div class="summary-line">' + escapeHtml(summary.join(' · ')) + '</div>' +
               highlighted +
               '</div>';
    }

    return '<div class="json-output">' + escapeHtml(String(data)) + '</div>';
}

// ============================================================
// JSON 语法高亮
// ============================================================
// syntaxHighlight
function syntaxHighlight(json) {
    var str = escapeHtml(json);
    // 高亮字符串（暂标记）
    str = str.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="json-str-temp">$&</span>');
    // 高亮数字
    str = str.replace(/\b(\d+\.?\d*)\b/g, '<span class="json-number">$1</span>');
    // 高亮 null
    str = str.replace(/\bnull\b/g, '<span class="json-null">null</span>');
    // 高亮 true/false
    str = str.replace(/\btrue\b/g, '<span class="json-bool">true</span>');
    str = str.replace(/\bfalse\b/g, '<span class="json-bool">false</span>');
    // 键名（冒号前的字符串）标绿
    str = str.replace(/<span class="json-str-temp">("(?:[^"\\]|\\.)*")<\/span>\s*:/g, '<span class="json-key">$1</span>:');
    // 值字符串标黄（剩下的字符串标记）
    str = str.replace(/<span class="json-str-temp">("[^"]*")<\/span>/g, '<span class="json-string">$1</span>');
    // 清理残留
    str = str.replace(/<span class="json-str-temp">/g, '<span class="json-string">');
    return str;
}

// ============================================================
// HTML 转义
// ============================================================
function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// ============================================================
// 清空输出
// ============================================================
function clearConsole() {
    var body = document.getElementById('outputBody');
    var meta = document.getElementById('outputMeta');
    if (body) body.innerHTML = '<div class="placeholder"><p>输出已清空</p></div>';
    if (meta) meta.textContent = '';
}

// ============================================================
// 捕获当前输入的参数
// ============================================================
function captureInputParams(target) {
    var params = { target: target };

    switch (target) {
        case 'CodeHandlers.execute':
            params.code = getParam('param_code') || '(空)';
            params.rowData = tryParsePretty('param_rowData');
            params.context = tryParsePretty('param_context');
            break;
        case 'CodeHandlers.list':
            break;
        case 'CodeHandlers.has':
            params.code = getParam('param_code') || '(空)';
            break;
        case 'handlers.parseRule':
            params.rule = getParam('param_rule') || '(空)';
            break;
        case 'handlers.processItemRules':
            params.item = tryParsePretty('param_item');
            params.character = tryParsePretty('param_character');
            break;
        case '__free__':
            params.表达式 = getParam('param_expr') || '(空)';
            break;
        default:
            // handlers.xxx.parse 系列
            if (target.indexOf('handlers.') === 0) {
                params.rule = getParam('param_rule') || '(空)';
            } else {
                params.raw = '(未识别参数)';
            }
            break;
    }

    return params;
}

// 尝试解析 JSON，失败则返回原始文本
function tryParsePretty(id) {
    var raw = getParam(id);
    if (!raw) return '(空)';
    try {
        return JSON.parse(raw);
    } catch(e) {
        return raw;
    }
}

// ============================================================
// 渲染输入条件摘要（带语法高亮）
// ============================================================
function renderInputSummary(params) {
    var keys = Object.keys(params);
    if (keys.length <= 1) return '';  // 只有 target 没有实际参数

    var lines = [];
    lines.push('<div class="input-summary-title">📥 输入条件</div>');

    var copyObj = { target: params.target };
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key === 'target') continue;
        var val = params[key];
        var valStr = (typeof val === 'object')
            ? JSON.stringify(val, null, 2)
            : String(val);
        lines.push('<div class="input-summary-row">' +
            '<span class="input-summary-key">' + key + '</span>' +
            '<span class="input-summary-val">' + syntaxHighlight(valStr) + '</span>' +
            '</div>');

        // 用于复制文本
        if (typeof params[key] === 'object') {
            try { copyObj[key] = JSON.parse(JSON.stringify(params[key])); }
            catch(e) { copyObj[key] = params[key]; }
        } else {
            copyObj[key] = params[key];
        }
    }

    // 复制用文本块
    var copyText = JSON.stringify(copyObj, null, 2);
    var safeText = escapeHtml(copyText);
    var copyId = 'copy_block_' + Date.now();
    lines.push('<div style="margin-top:10px; border-top:1px solid #4a4a4a; padding-top:8px;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
        '<span style="color:#8a7a6a;font-size:11px;">📋 复制输入</span>' +
        '<button onclick="navigator.clipboard.writeText(document.getElementById(\'' + copyId + '\').textContent)" ' +
        'style="background:#3a3a3a;border:1px solid #5a5a5a;color:#c4b4a4;padding:2px 10px;border-radius:3px;cursor:pointer;font-size:11px;">复制</button>' +
        '</div>' +
        '<pre id="' + copyId + '" style="background:#1a1a1a;border:1px solid #3a3a3a;border-radius:4px;padding:8px 12px;font-size:11px;font-family:Consolas,monospace;color:#b4a490;white-space:pre-wrap;word-break:break-all;margin:0;max-height:200px;overflow-y:auto;user-select:all;">' + safeText + '</pre>' +
        '</div>');

    return lines.join('');
}

// ============================================================
// 初始化
// ============================================================
renderApiTree();
onTargetChange();