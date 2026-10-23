# ============================================================
# api/report.py - 纠错反馈 API
# ============================================================
# 作用：
#   1. 前台用户提交纠错反馈（POST /api/report）
#   2. 前台查看自己的反馈（GET /api/reports?ip=xxx）
#   3. 后台管理员查看反馈列表（GET /api/admin/reports）
#   4. 后台管理员更新反馈状态（PUT /api/admin/reports/<id>/status）
#   5. 后台管理员删除反馈（DELETE /api/admin/reports/<id>）
#
# 数据库表：reports
#   - id: 主键
#   - ip: 用户IP地址
#   - content: 反馈内容
#   - rule_type: 规则版本（如 dnd5r）
#   - status: 状态（0=未读, 1=已收到, 2=已完成）
#   - completed_at: 完成时间（用于自动清理）
#   - created_at: 创建时间
#
# 首次部署请执行：
#   ALTER TABLE reports ADD COLUMN status TINYINT NOT NULL DEFAULT 0 COMMENT '0=未读, 1=已收到, 2=已完成';
#   ALTER TABLE reports ADD COLUMN completed_at DATETIME DEFAULT NULL COMMENT '完成时间';
# ============================================================

from flask import Blueprint, request, jsonify  # Flask 框架核心组件
import pymysql                                  # MySQL 数据库连接库
from config import DB_CONFIG                    # 数据库配置
from datetime import datetime                   # 时间处理

# ============================================================
# 创建蓝图（前台接口）
# ============================================================
report_bp = Blueprint('report', __name__, url_prefix='/api')


# ============================================================
# 前台：提交纠错反馈
# ============================================================
@report_bp.route('/report', methods=['POST'])
def submit_report():
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if ip and ',' in ip:
        ip = ip.split(',')[0].strip()

    data = request.get_json()
    content = data.get('content', '').strip()
    rule_type = data.get('rule_type', 'dnd5r').strip() or 'dnd5r'

    if not content:
        return jsonify({'success': False, 'message': '错误描述不能为空'}), 400

    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT COUNT(*) FROM reports WHERE ip = %s AND created_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)",
        (ip,)
    )
    count = cursor.fetchone()[0]
    if count >= 1:
        cursor.close()
        conn.close()
        return jsonify({'success': False, 'message': '每2分钟仅可提交1次，请稍后再试'}), 429

    cursor.execute(
        "INSERT INTO reports (ip, content, rule_type, status) VALUES (%s, %s, %s, 0)",
        (ip, content, rule_type)
    )
    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({'success': True, 'message': '反馈已收到，感谢你的帮助！📝'})


# ============================================================
# 前台：获取我的反馈列表（仅本IP可见）
# ============================================================
# 路由：GET /api/reports
# 说明：自动识别请求者IP，只返回该IP的反馈，已完成的仅保留一周
# ============================================================
@report_bp.route('/reports')
def get_public_reports():
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if ip and ',' in ip:
        ip = ip.split(',')[0].strip()

    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    offset = (page - 1) * limit

    # 统计总数（只查该IP，排除已完成超过一周的）
    cursor.execute("""
        SELECT COUNT(*) as total FROM reports
        WHERE ip = %s
        AND (status != 2 OR (status = 2 AND completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)))
    """, (ip,))
    total = cursor.fetchone()['total']

    # 查询列表
    cursor.execute(f"""
        SELECT id, content, rule_type, status, created_at
        FROM reports
        WHERE ip = %s
        AND (status != 2 OR (status = 2 AND completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)))
        ORDER BY FIELD(status, 0, 1, 2), created_at DESC
        LIMIT %s OFFSET %s
    """, (ip, limit, offset))

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
admin_report_bp = Blueprint('admin_report', __name__, url_prefix='/api/admin')


# ============================================================
# 后台：获取反馈列表
# ============================================================
@admin_report_bp.route('/reports')
def get_reports():
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    keyword = request.args.get('keyword', '').strip()
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 15))
    offset = (page - 1) * limit

    where_clauses = []
    params = []

    if keyword:
        where_clauses.append('(content LIKE %s OR ip LIKE %s OR rule_type LIKE %s)')
        params.extend([f'%{keyword}%', f'%{keyword}%', f'%{keyword}%'])

    where_sql = 'WHERE ' + ' AND '.join(where_clauses) if where_clauses else ''

    count_sql = f'SELECT COUNT(*) as total FROM reports {where_sql}'
    cursor.execute(count_sql, params if params else ())
    total = cursor.fetchone()['total']

    cursor.execute(f"""
        SELECT id, ip, content, rule_type, status, created_at
        FROM reports
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
# 后台：更新反馈状态
# ============================================================
# 路由：PUT /api/admin/reports/<id>/status
# 请求体：{ "status": 1 }
#   0=未读, 1=已收到, 2=已完成
# ============================================================
@admin_report_bp.route('/reports/<int:report_id>/status', methods=['PUT'])
def update_report_status(report_id):
    data = request.get_json()
    new_status = data.get('status')

    if new_status not in (0, 1, 2):
        return jsonify({'code': 1, 'msg': '无效的状态值'}), 400

    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()

    if new_status == 2:
        cursor.execute(
            "UPDATE reports SET status = %s, completed_at = %s WHERE id = %s",
            (new_status, datetime.now(), report_id)
        )
    else:
        cursor.execute(
            "UPDATE reports SET status = %s, completed_at = NULL WHERE id = %s",
            (new_status, report_id)
        )

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({'code': 0, 'msg': '状态更新成功'})


# ============================================================
# 后台：删除反馈
# ============================================================
@admin_report_bp.route('/reports/<int:report_id>', methods=['DELETE'])
def delete_report(report_id):
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM reports WHERE id = %s", (report_id,))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({'code': 0, 'msg': '删除成功'})