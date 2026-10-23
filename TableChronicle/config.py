# config.py
# 全局配置文件



# 数据库配置（后续连接 MySQL 时用）
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '123456789',   # 就是刚才设的
    'database': 'dnd_db',
    'charset': 'utf8mb4'
}

# 规则版本列表（显示文本 + 实际值）
RULES = [
    
    {'value': 'dnd5r', 'label': 'DND 5R（修订版）'},
    {'value': 'dnd5e', 'label': 'DND 5E（第五版）'},
]

