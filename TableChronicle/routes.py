import os
from flask import send_from_directory, send_file, request, abort

# 项目根目录
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

def serve_file(relative_path):
    """安全地提供文件"""
    filepath = os.path.join(ROOT_DIR, relative_path)
    if not os.path.isfile(filepath):
        abort(404)
    return send_file(filepath)

def register_routes(app):
    # ===== 后台管理 =====
    # 登录页
    @app.route('/backstage/login')
    def backstage_login():
        return send_from_directory('backstage', 'login.html')

    # 后台主页
    @app.route('/backstage')
    def backstage():
        return send_from_directory('backstage', 'backstage.html')

    # 后台静态资源
    @app.route('/backstage/<path:filename>')
    def backstage_static(filename):
        return send_from_directory('backstage', filename)

    # ===== 首页 =====
    @app.route('/')
    def index():
        return send_from_directory('index', 'index.html')

    # ===== 许愿池 =====
    @app.route('/wish')
    def wish():
        return send_from_directory('wish', 'wish.html')

    # ===== 纠错反馈 =====
    @app.route('/report')
    def report():
        return send_from_directory('report', 'report.html')

    # ===== 游戏占位 =====
    @app.route('/game')
    def game():
        rule = request.args.get('rule', 'dnd5e')
        return f"游戏页面建设中，当前规则：{rule}"

    # ===== 车卡相关（统一入口） =====
    @app.route('/character')
    def character_index():
        return serve_file('character/index.html')

    @app.route('/character/<path:filename>')
    def character_files_or_rule(filename):
        # 处理静态文件（CSS/JS）
        if filename.endswith('.css') or filename.endswith('.js'):
            return serve_file(f'character/{filename}')

        # 处理规则入口 — 指向 creation/ 下的车卡页面
        allowed_rules = ['dnd_5r', 'dnd_5e', 'coc', 'pf']
        if filename in allowed_rules:
            return serve_file(f'character/{filename}/creation/character.html')

        # 处理规则内的静态资源（如 /character/dnd_5r/creation/character.css）
        if '/' in filename:
            rule, rest = filename.split('/', 1)
            if rule in allowed_rules:
                return serve_file(f'character/{rule}/{rest}')

        return "页面不存在", 404

    # ===== 通用静态文件（放在最后） =====
    @app.route('/<path:filename>')
    def serve_static(filename):
        return serve_file(filename)