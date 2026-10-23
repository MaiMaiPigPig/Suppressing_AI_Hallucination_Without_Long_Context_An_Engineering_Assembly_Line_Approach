$(function() {

    layui.use(['table', 'layer'], function() {
        var table = layui.table;
        var layer = layui.layer;

        // 类型映射
        var typeMap = {
            'new_rule': '新增规则',
            'new_class': '新增职业',
            'new_feature': '新增功能'
        };

        // 状态映射
        var statusMap = {
            0: '<span style="color:#999;">未读</span>',
            1: '<span style="color:#1e9fff;">已收到</span>',
            2: '<span style="color:#16baaa;">已完成</span>'
        };

        // 初始化表格
        table.render({
            elem: '#wishTable',
            url: '/api/admin/wishes',
            page: true,
            limit: 10,
            toolbar: '#topToolbar',
            cols: [[
                { type: 'checkbox' },
                { field: 'id', title: 'ID', width: 70, sort: true },
                { field: 'ip', title: 'IP', width: 120 },
                { field: 'type', title: '类型', width: 100, templet: function(d) {
                    return typeMap[d.type] || d.type || '-';
                }},
                { field: 'status', title: '状态', width: 80, templet: function(d) {
                    return statusMap[d.status] || statusMap[0];
                }},
                { field: 'content', title: '心愿内容', minWidth: 200, templet: function(d) {
                    if (!d.content) return '<span style="color:#bbaa8a;">-</span>';
                    var content = d.content.length > 50 ? d.content.substring(0, 50) + '...' : d.content;
                    return '<span title="' + d.content + '">' + content + '</span>';
                }},
                { field: 'created_at', title: '创建时间', width: 160 },
                { field: 'operate', title: '操作', toolbar: '#wishToolbar', width: 200, fixed: 'right' }
            ]]
        });

        // 搜索
        $('#searchBtn').click(function() {
            var keyword = $('#searchInput').val().trim();
            table.reload('wishTable', {
                where: { keyword: keyword },
                page: { curr: 1 }
            });
        });

        // 工具栏事件（顶部刷新按钮）
        table.on('toolbar(wishTable)', function(obj) {
            if (obj.event === 'refresh') {
                table.reload('wishTable');
            }
        });

        // 行内工具事件（每行的操作按钮）
        table.on('tool(wishTable)', function(obj) {
            var data = obj.data;
            console.log('tool event:', obj.event, 'data:', data);

            if (obj.event === 'delete') {
                layer.confirm('确定删除该心愿吗？', function(index) {
                    $.ajax({
                        url: '/api/admin/wishes/' + data.id,
                        type: 'DELETE',
                        success: function(res) {
                            if (res.code === 0) {
                                layer.msg('删除成功', {icon: 1});
                                table.reload('wishTable');
                            } else {
                                layer.msg(res.msg || '删除失败', {icon: 2});
                            }
                        }
                    });
                    layer.close(index);
                });
            } else if (obj.event === 'receive') {
                layer.confirm('标记为「已收到」？', function(index) {
                    $.ajax({
                        url: '/api/admin/wishes/' + data.id + '/status',
                        type: 'PUT',
                        contentType: 'application/json',
                        data: JSON.stringify({ status: 1 }),
                        success: function(res) {
                            if (res.code === 0) {
                                layer.msg('已标记为收到', {icon: 1});
                                table.reload('wishTable');
                            } else {
                                layer.msg(res.msg || '操作失败', {icon: 2});
                            }
                        }
                    });
                    layer.close(index);
                });
            } else if (obj.event === 'complete') {
                layer.confirm('标记为「已完成」？', function(index) {
                    $.ajax({
                        url: '/api/admin/wishes/' + data.id + '/status',
                        type: 'PUT',
                        contentType: 'application/json',
                        data: JSON.stringify({ status: 2 }),
                        success: function(res) {
                            if (res.code === 0) {
                                layer.msg('已标记为完成', {icon: 1});
                                table.reload('wishTable');
                            } else {
                                layer.msg(res.msg || '操作失败', {icon: 2});
                            }
                        }
                    });
                    layer.close(index);
                });
            }
        });
    });
});