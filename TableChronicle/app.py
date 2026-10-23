# 810·1650·4440 事业顺遂，快速发展
#  🐟 蓝色大肥鱼镇守此代码，Bug退散！
#
# app.py
from flask import Flask, Response
from api.wish import wish_bp, admin_wish_bp
from api.report import report_bp, admin_report_bp

from routes import register_routes

app = Flask(__name__, template_folder='.')

app.register_blueprint(wish_bp)
app.register_blueprint(admin_wish_bp)
app.register_blueprint(report_bp)
app.register_blueprint(admin_report_bp)


register_routes(app)

# 浏览器会自动请求 favicon.ico，直接返回 204 避免 404 刷屏
@app.route('/favicon.ico')
def favicon():
    return Response(status=204)

if __name__ == '__main__':
    import os
    # 测试脚本（运行测试.bat）后台启动时通过环境变量关闭 reloader，
    # 避免 debug=True 的 reloader 派生双进程导致端口占用/清理困难；默认行为保持不变。
    if os.environ.get('FLASK_RELOADER') == '0':
        app.run(debug=True, port=5001, use_reloader=False)
    else:
        app.run(debug=True, port=5001)