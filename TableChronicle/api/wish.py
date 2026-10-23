# ============================================================
# api/wish.py - 许愿池 API
# ============================================================
# 作用：
#   1. 前台用户提交心愿（POST /api/wish）
#   2. 前台查看心愿列表（GET /api/wishes）
#   3. 后台管理员查看心愿列表（GET /api/admin/wishes）
#   4. 后台管理员更新心愿状态（PUT /api/admin/wishes/<id>/status）
#   5. 后台管理员删除心愿（DELETE /api/admin/wishes/<id>）
#
# 数据库表：wishes
#   - id: 主键
#   - ip: 用户IP地址
#   - content: 心愿内容
#   - type: 心愿类型（new_rule=新增规则, new_class=新增职业, new_feature=新增功能）
#   - status: 状态（0=未读, 1=已收到, 2=已完成）
#   - completed_at: 完成时间（用于自动清理）
#   - created_at: 创建时间
#
# 首次部署请执行：
#   ALTER TABLE wishes ADD COLUMN status TINYINT NOT NULL DEFAULT 0 COMMENT '0=未读, 1=已收到, 2=已完成';
#   ALTER TABLE wishes ADD COLUMN completed_at DATETIME DEFAULT NULL COMMENT '完成时间';
# ============================================================

from flask import Blueprint, request, jsonify  # Flask 框架核心组件
import pymysql                                  # MySQL 数据库连接库
from config import DB_CONFIG                    # 数据库配置
from datetime import datetime                   # 时间处理

# ============================================================
# 创建蓝图（前台接口）
# ============================================================
wish_bp = Blueprint('wish', __name__, url_prefix='/api')


# ============================================================
# 前台：提交心愿
# ============================================================
@wish_bp.route('/wish', methods=['POST'])
def submit_wish():
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if ip and ',' in ip:
        ip = ip.split(',')[0].strip()

    data = request.get_json()
    content = data.get('content', '').strip()
    wish_type = data.get('type', '').strip()

    if not content:
        return jsonify({'success': False, 'message': '心愿内容不能为空'}), 400
    if not wish_type:
        return jsonify({'success': False, 'message': '请选择心愿类型'}), 400

    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT COUNT(*) FROM wishes WHERE ip = %s AND created_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)",
        (ip,)
    )
    count = cursor.fetchone()[0]
    if count >= 1:
        cursor.close()
        conn.close()
        return jsonify({'success': False, 'message': '每2分钟仅可许愿1次，请稍后再试'}), 429

    cursor.execute(
        "INSERT INTO wishes (ip, content, type, status) VALUES (%s, %s, %s, 0)",
        (ip, content, wish_type)
    )
    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({'success': True, 'message': '心愿已投入许愿池！✨'})


# ============================================================
# 前台：获取心愿列表（公开）
# ============================================================
# 路由：GET /api/wishes
# 说明：显示所有心愿，已完成的仅保留一周
# ============================================================
@wish_bp.route('/wishes')
def get_public_wishes():
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    offset = (page - 1) * limit

    # 统计总数（排除已完成超过一周的）
    cursor.execute("""
        SELECT COUNT(*) as total FROM wishes
        WHERE status != 2 OR (status = 2 AND completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))
    """)
    total = cursor.fetchone()['total']

    # 查询列表（未读和已收到排前面，已完成排后面，全部按时间倒序）
    cursor.execute(f"""
        SELECT id, content, type, status, created_at
        FROM wishes
        WHERE status != 2 OR (status = 2 AND completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))
        ORDER BY FIELD(status, 0, 1, 2), created_at DESC
        LIMIT %s OFFSET %s
    """, (limit, offset))

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify({
        'success': True,
        'total': total,
        'data': rows
    })


# ============================================================
# 管理后台接口
# ============================================================
admin_wish_bp = Blueprint('admin_wish', __name__, url_prefix='/api/admin')


# ============================================================
# 后台：获取许愿池列表
# ============================================================
@admin_wish_bp.route('/wishes')
def get_wishes():
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    keyword = request.args.get('keyword', '').strip()
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 15))
    offset = (page - 1) * limit

    where_clauses = []
    params = []

    if keyword:
        where_clauses.append('(content LIKE %s OR ip LIKE %s OR type LIKE %s)')
        params.extend([f'%{keyword}%', f'%{keyword}%', f'%{keyword}%'])

    where_sql = 'WHERE ' + ' AND '.join(where_clauses) if where_clauses else ''

    count_sql = f'SELECT COUNT(*) as total FROM wishes {where_sql}'
    cursor.execute(count_sql, params if params else ())
    total = cursor.fetchone()['total']

    cursor.execute(f"""
        SELECT id, ip, content, type, status, created_at
        FROM wishes
        {where_sql}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
    """, params + [limit, offset] if params else [limit, offset])

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify({
        'code': 0,
        'msg': '成功',
        'count': total,
        'data': rows
    })


# ============================================================
# 后台：更新心愿状态
# ============================================================
# 路由：PUT /api/admin/wishes/<id>/status
# 请求体：{ "status": 1 }
#   0=未读, 1=已收到, 2=已完成
# ============================================================
@admin_wish_bp.route('/wishes/<int:wish_id>/status', methods=['PUT'])
def update_wish_status(wish_id):
    data = request.get_json()
    new_status = data.get('status')

    if new_status not in (0, 1, 2):
        return jsonify({'code': 1, 'msg': '无效的状态值'}), 400

    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()

    # 如果标记为已完成，记录完成时间
    if new_status == 2:
        cursor.execute(
            "UPDATE wishes SET status = %s, completed_at = %s WHERE id = %s",
            (new_status, datetime.now(), wish_id)
        )
    else:
        cursor.execute(
            "UPDATE wishes SET status = %s, completed_at = NULL WHERE id = %s",
            (new_status, wish_id)
        )

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({'code': 0, 'msg': '状态更新成功'})


# ============================================================
# 后台：删除心愿
# ============================================================
@admin_wish_bp.route('/wishes/<int:wish_id>', methods=['DELETE'])
def delete_wish(wish_id):
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM wishes WHERE id = %s", (wish_id,))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({'code': 0, 'msg': '删除成功'})