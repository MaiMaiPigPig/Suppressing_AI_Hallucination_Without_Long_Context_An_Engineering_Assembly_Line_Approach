// ============================================================
// code-handlers 注册表
// 负责管理 code 列 handler 的注册和执行
// ============================================================
//
// 【作用】
// 数据表的 code 列存放功能标记（如 "choose"），
// 注册表根据标记找到对应的 JS 函数来执行。
//
// 【使用方式】
//   CodeHandlers.register('choose', handleChoose);
//   CodeHandlers.execute('choose', rowData, context);
//
// 【注册新的 handler】
//   在 code-handlers/ 下新建文件，写处理函数，
//   在文件末尾调用 CodeHandlers.register('名称', 函数) 即可。
//   文件引入顺序不影响注册，执行时才查找。

(function() {
    var handlers = {};

    var CodeHandlers = {

        // 注册 handler
        // name: code 列的值（如 "choose"）
        // handlerFn: 处理函数，接收 (rowData, context)
        register: function(name, handlerFn) {
            if (handlers[name]) {
                console.warn('code handler 重复注册:', name);
            }
            handlers[name] = handlerFn;
        },

        // 执行 handler
        // code: code 列的值
        // rowData: 整行数据对象（所有列）
        // context: 执行上下文 { character, callbacks, ... }
        // 返回值: handler 的返回结果，或 false（未找到时）
        execute: function(code, rowData, context) {
            var handler = handlers[code];
            if (!handler) {
                console.warn('未找到 code handler:', code);
                return false;
            }
            return handler(rowData, context);
        },

        // 检查 handler 是否已注册
        has: function(code) {
            return !!handlers[code];
        },

        // 获取所有已注册的 handler 名称列表
        list: function() {
            var names = [];
            for (var name in handlers) {
                if (Object.prototype.hasOwnProperty.call(handlers, name)) {
                    names.push(name);
                }
            }
            return names;
        }
    };

    window.CodeHandlers = CodeHandlers;
})();