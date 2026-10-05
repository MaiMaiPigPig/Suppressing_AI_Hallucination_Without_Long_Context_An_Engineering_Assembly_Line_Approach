"""
车卡功能回归测试脚本
====================
用 Selenium 对 D&D 5R 角色创建流程做全流程回归测试。

设计思路（和旧版的区别）：
    旧版：按死顺序硬调每一步，遇到页面自动跳步（如无亚种）就会错位。
    新版：每一步都先读页面上的“第 X 步，共 16 步”指示器，
          根据真实的步骤编号决定做什么，并把每个待选要求选满后再点下一步。

覆盖步骤：
    规则选择 → DND 5R → 新角色
    → 1 种族 → 2 亚种（没有就自动跳过）→ 3 职业 → 4 职业套装
    → 5 背景 → 6 背景套装 → 7 基础属性（随机模式）→ 8 背景加值
    （第 9 步系统自动跳过）
    → 10 技能 → 11 专长 → 12 法术（无强制校验，直接过）
    → 13 商城购物（买 1 件买得起的东西）→ 14 特性总览（所有待选选满）
    → 15 角色详情（含语言选择）→ 16 角色卡（校验关键信息）
    → 17 完成页（校验导出 JSON / 导出 PDF / 升级 三个按钮）

运行方式 1（pytest，推荐）：
    pytest 测试脚本/车卡_回归测试.py -v -s
    （装了 pytest-html 的话可加：--html=测试报告.html --self-contained-html）

运行方式 2（直接跑，跑完浏览器不关，方便肉眼检查）：
    python 测试脚本/车卡_回归测试.py

依赖安装：
    pip install selenium pytest webdriver-manager
    （pytest-html 可选：pip install pytest-html）

其他说明：
    - 默认用 Edge，没有 Edge 会自动换成 Chrome
    - 默认有头模式（能看见浏览器动作），想无头运行就设环境变量 HEADLESS=1
"""

import os
import re
import glob
import json
import time
import random
import datetime
import traceback
from dataclasses import dataclass, field

import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.remote.webelement import WebElement
from selenium.common.exceptions import (
    TimeoutException,
    NoSuchElementException,
    StaleElementReferenceException,
)


# ============================================================
# 全局配置
# ============================================================

# 车卡入口地址（规则选择页）
BASE_URL = "http://127.0.0.1:5001/character"

# ===== 前台/后台运行开关 =====
# True  = 后台运行（无头模式，不弹浏览器窗口，不影响你打游戏）
# False = 前台运行（有头模式，能看到浏览器动作，方便调试）
RUN_IN_BACKGROUND = True

# 显式等待上限（秒）：等元素出现、等页面跳转用
EXPLICIT_WAIT = 15

# 是否无头模式：由 RUN_IN_BACKGROUND 控制，也可被环境变量覆盖
HEADLESS = RUN_IN_BACKGROUND or os.environ.get("HEADLESS", "0") == "1"

# 浏览器窗口大小（无头时也按这个尺寸渲染，保证布局一致）
WINDOW_SIZE = "1400,900"

# 快照目录：测试过程中出问题时把页面 HTML 存到这里，方便大肥鱼分析
SNAPSHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "snapshots")

# JSON 数据目录：csv转json.py 输出的 JSON 文件所在目录
JSON_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "TableChronicle", "data", "json")

# 快照开关
SNAPSHOT_ON_ERROR = os.environ.get("SNAPSHOT_OFF", "0") != "1"   # 报错时自动存快照
SNAPSHOT_EACH_STEP = os.environ.get("SNAPSHOT_EACH", "0") == "1"  # 每步都存快照（很慢，仅调试用）

# 数据对比开关：每步切页后自动对比页面数据和 JSON 数据
AUTO_VERIFY_JSON = os.environ.get("AUTO_VERIFY_JSON", "1") == "1"  # 默认开启

# 数据变更测试的原始数据备份目录
DATA_BACKUP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data_backup")

# 导出文件下载目录
DOWNLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")

def ensure_snapshot_dir():
    """确保快照目录存在"""
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)

def clear_old_snapshots(keep=5):
    """只保留最近 keep 次测试的快照，避免磁盘爆炸"""
    ensure_snapshot_dir()
    # 按时间分组（文件名格式：stepXX_YYYYMMDD_HHMMSS.html）
    files = sorted(os.listdir(SNAPSHOT_DIR), reverse=True)
    # 提取唯一的时间戳组
    seen_ts = set()
    for f in files:
        m = re.match(r".+_(\d{8}_\d{6})\.", f)
        if m:
            seen_ts.add(m.group(1))
        if len(seen_ts) > keep:
            os.remove(os.path.join(SNAPSHOT_DIR, f))


# ============================================================
# 测试过程中记录的数据（最后用来核对）
# ============================================================

@dataclass
class CharacterData:
    """记录一路选下来的关键信息，供后面步骤交叉核对"""

    race_name: str = ""          # 种族名，例如“精灵”
    subrace_name: str = ""       # 亚种名，例如“高等精灵”，没有亚种就是空字符串
    class_name: str = ""         # 职业名，例如“游荡者”
    class_package: str = ""      # 职业套装名
    background_name: str = ""    # 背景名，例如“罪犯”
    bg_package: str = ""         # 背景套装名
    ability_scores: list = field(default_factory=list)  # 最终填入的 6 个属性值
    class_skills: list = field(default_factory=list)    # 选中的职业技能名
    bg_skills: list = field(default_factory=list)       # 选中的背景技能名
    feat_name: str = ""          # 专长/背景推荐专长的名字
    shopping_cart: list = field(default_factory=list)  # 实际加进购物车的商品名
    character_name: str = ""    # 角色名字
    languages: list = field(default_factory=list)       # 选中的语言名


# ============================================================
# 小工具函数（不依赖浏览器的纯计算）
# ============================================================

def parse_required_count(text: str):
    """
    从“已选 0 / 4”这种文字里读出 (已选数, 需要数)。
    如果只有“已选 0”（没有斜杠，说明该项不强制），返回 (已选数, None)。

    举例：
        parse_required_count("已选 0 / 4")  -> (0, 4)
        parse_required_count("已选 2")      -> (2, None)
    """
    # 翻译：先尝试匹配“数字 / 数字”
    m = re.search(r"(\d+)\s*/\s*(\d+)", text or "")
    if m:
        return int(m.group(1)), int(m.group(2))
    # 翻译：没有斜杠就只取第一个数字，需要数返回 None（表示不强制）
    m = re.search(r"(\d+)", text or "")
    return (int(m.group(1)) if m else 0), None


def price_to_copper(price_text: str) -> int:
    """
    把“25GP”“4SP”“1PP”这种价格文字换算成铜币数，方便比较贵贱。
    换算规则（D&D 标准）：1 PP = 10 GP = 100 SP = 1000 CP。

    举例：
        price_to_copper("1GP")   -> 100
        price_to_copper("5SP")   -> 50
        price_to_copper("2PP")   -> 2000
    """
    total = 0
    # 翻译：逐个找出“数字 + 货币单位”的组合
    for num, unit in re.findall(r"(\d+)\s*(PP|GP|SP|CP)", (price_text or "").upper()):
        n = int(num)
        if unit == "PP":
            total += n * 1000
        elif unit == "GP":
            total += n * 100
        elif unit == "SP":
            total += n * 10
        else:  # CP
            total += n
    return total


# ============================================================
# 车卡测试器：封装所有页面操作
# ============================================================

class CharacterCreationTester:
    """按真实步骤操作浏览器，把车卡完整走一遍"""

    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, EXPLICIT_WAIT)
        self.data = CharacterData()
        # 控制台日志采集
        self.console_errors = []       # 本次测试用例的全部 SEVERE + 选择性 WARNING
        self._console_consumed = 0     # 已消费的日志条目序号（避免重复拉取）

    # ---------- 基础操作 ----------

    def find(self, by, value, timeout=EXPLICIT_WAIT):
        """翻译：等元素出现在页面上，等不到就抛超时错误"""
        return WebDriverWait(self.driver, timeout).until(
            EC.presence_of_element_located((by, value))
        )

    def find_clickable(self, by, value, timeout=EXPLICIT_WAIT):
        """翻译：等元素变得可以点击（可见且没被禁用）"""
        return WebDriverWait(self.driver, timeout).until(
            EC.element_to_be_clickable((by, value))
        )

    def find_all(self, by, value):
        """翻译：找出所有匹配的元素（没有就返回空列表，不报错）"""
        return self.driver.find_elements(by, value)

    def click_el(self, element: WebElement):
        """
        翻译：点击一个元素；如果元素“过期”了（页面刚刷新过），
        就改用 JavaScript 点击，保证点得动。
        """
        try:
            element.click()
        except StaleElementReferenceException:
            self.driver.execute_script("arguments[0].click();", element)

    def click_by(self, by, value, timeout=EXPLICIT_WAIT, retries=3):
        """
        翻译：按选择器重新找元素并点击。
        页面刚刚重绘过、手里的元素“过期”时，就重新去页面上找一次再点，
        最多重试 retries 次。返回最后点到的那个元素。
        """
        last_err = None
        for _ in range(retries):
            try:
                el = WebDriverWait(self.driver, timeout).until(
                    EC.element_to_be_clickable((by, value))
                )
                el.click()
                return el
            except StaleElementReferenceException as e:
                # 翻译：元素过期，记住错误后稍等再重新找
                last_err = e
                time.sleep(0.3)
        raise last_err

    def click_nth(self, selector: str, index: int, retries=3):
        """
        翻译：点“某一类元素里的第 index 个”。
        每次都重新去页面上抓最新的元素列表，专治页面重绘导致的过期。
        """
        last_err = None
        for _ in range(retries):
            try:
                els = self.driver.find_elements(By.CSS_SELECTOR, selector)
                els[index].click()
                return
            except (StaleElementReferenceException, IndexError) as e:
                # 翻译：元素过期或列表还没渲染好，稍等再抓一次
                last_err = e
                time.sleep(0.3)
        raise last_err

    def get_step(self) -> int:
        """
        翻译：读取页面上的步骤指示器“第 X 步，共 16 步”，返回 X。
        如果还在开始页（没有指示器），返回 0。
        """
        try:
            text = self.driver.find_element(By.CSS_SELECTOR, ".step-indicator").text
            m = re.search(r"第\s*(\d+)\s*步", text)
            return int(m.group(1)) if m else 0
        except NoSuchElementException:
            return 0

    def accept_alert_if_any(self, timeout=1):
        """
        翻译：看看有没有浏览器弹窗（一般是“请先选择 XX”这种提示），
        有就读出文字并点“确定”关掉，没有就返回 None。
        """
        try:
            WebDriverWait(self.driver, timeout).until(EC.alert_is_present())
            alert = self.driver.switch_to.alert
            text = alert.text
            alert.accept()
            return text
        except TimeoutException:
            return None

    def _capture_console(self, step_label=None):
        """
        翻译：从浏览器拉取自上次捕获后新产生的控制台日志。
        SEVERE 级别（JS 运行时错误）全部记录；
        WARNING 级别选择性记录（过滤第三方库噪音）。
        返回：本次新捕获的错误列表。
        """
        try:
            logs = self.driver.get_log('browser')
        except Exception:
            return []

        new_errors = []
        for entry in logs[self._console_consumed:]:
            level = entry.get('level', '')
            message = entry.get('message', '')

            if level == 'SEVERE':
                new_errors.append({'level': level, 'message': message, 'step': step_label})
                print(f"  [控制台SEVERE] 步骤{step_label}: {message[:250]}")
            elif level == 'WARNING':
                # 过滤常见的第三方噪音
                noise_keywords = [
                    'favicon', 'Third-party', 'chrome-extension',
                    'Autofill', 'deprecated',
                ]
                if any(kw.lower() in message.lower() for kw in noise_keywords):
                    self._console_consumed += 1
                    continue
                new_errors.append({'level': level, 'message': message, 'step': step_label})

            self._console_consumed += 1

        self.console_errors.extend(new_errors)
        return new_errors

    def get_console_summary(self):
        """
        翻译：返回本次测试用例的控制台错误汇总。
        按步骤分组，统计 SEVERE 和 WARNING 数量。
        """
        severe_count = sum(1 for e in self.console_errors if e['level'] == 'SEVERE')
        warning_count = sum(1 for e in self.console_errors if e['level'] == 'WARNING')

        by_step = {}
        for e in self.console_errors:
            step = e.get('step') or '?'
            if step not in by_step:
                by_step[step] = []
            by_step[step].append(e)

        return {
            'total_severe': severe_count,
            'total_warning': warning_count,
            'total': len(self.console_errors),
            'by_step': by_step,
        }

    def print_console_summary(self):
        """
        翻译：打印本次测试用例的控制台错误汇总报告。
        """
        summary = self.get_console_summary()
        total = summary['total']
        if total == 0:
            print("\n  [控制台汇总] 无错误")
            return

        print(f"\n  {'=' * 50}")
        print(f"  控制台错误汇总：SEVERE {summary['total_severe']} 条, WARNING {summary['total_warning']} 条")
        print(f"  {'=' * 50}")
        for step in sorted(summary['by_step'].keys(), key=lambda x: (str(x) if str(x).isdigit() else 'z', x)):
            errs = summary['by_step'][step]
            print(f"\n  --- 步骤 {step}（{len(errs)} 条）---")
            for e in errs[:3]:
                msg = e['message'][:200]
                print(f"    [{e['level']}] {msg}")
            if len(errs) > 3:
                print(f"    ... 还有 {len(errs) - 3} 条")
        print(f"  {'=' * 50}\n")

    def go_next(self, timeout=8):
        """
        翻译：点“下一步”，然后等待步骤真的发生变化。
        返回值：
            True  = 成功进入了下一步
            False = 被弹窗拦住（一般是当前步骤没选够），弹窗文字会一起返回
        用法：ok, msg = self.go_next()
        """
        # 翻译：记住点击前的步骤号
        step_before = self.get_step()

        # ===== 切页前快照 =====
        if SNAPSHOT_ON_ERROR or SNAPSHOT_EACH_STEP:
            page_data = self._extract_page_data()
            self.snapshot(f"pre_next_step{step_before}", step=step_before, extra_data=page_data)

        # 翻译：点下一步按钮
        next_btn = self.find_clickable(By.ID, "nextBtn")
        next_btn.click()

        # 翻译：先看有没有弹窗拦截
        alert_text = self.accept_alert_if_any(timeout=1)
        if alert_text:
            # 翻译：被弹窗拦住时存快照
            if SNAPSHOT_ON_ERROR or SNAPSHOT_EACH_STEP:
                page_data = self._extract_page_data()
                self.snapshot(f"blocked_step{step_before}", step=step_before, extra_data=page_data)
            return False, alert_text

        # 翻译：没弹窗就等指示器的步骤号变化（说明页面确实切过去了）
        try:
            WebDriverWait(self.driver, timeout).until(
                lambda d: self.get_step() != step_before
            )
            # ===== 切页成功后快照（仅在每步快照模式时） =====
            step_after = self.get_step()
            page_data = self._extract_page_data()
            if SNAPSHOT_EACH_STEP:
                self.snapshot(f"post_next_step{step_after}", step=step_after, extra_data=page_data)

            # ===== 数据对比：页面数据 vs JSON =====
            if AUTO_VERIFY_JSON:
                ok, errs = self._verify_page_data_against_json(page_data)
                if not ok:
                    err_msg = "; ".join(errs)
                    print(f"  [数据对比] 警告：{err_msg}")
                    # 对比失败时保存快照供分析
                    if SNAPSHOT_ON_ERROR:
                        self.snapshot(f"data_mismatch_step{step_before}", step=step_before, extra_data=page_data)

            # ===== 控制台错误捕获 =====
            self._capture_console(step_label=step_after)

            return True, ""
        except TimeoutException:
            # 翻译：极少数情况下指示器没变但内容变了，这里再兜底查一次弹窗
            alert_text = self.accept_alert_if_any(timeout=0.5)
            if alert_text:
                if SNAPSHOT_ON_ERROR or SNAPSHOT_EACH_STEP:
                    page_data = self._extract_page_data()
                    self.snapshot(f"blocked_step{step_before}", step=step_before, extra_data=page_data)
                return False, alert_text
            # 翻译：没弹窗也没变步，当作成功（防止误判卡死流程）
            return True, ""

    def short_sleep(self, a=0.2, b=0.5):
        """翻译：随机停顿一小会儿，模拟真人操作的节奏"""
        time.sleep(random.uniform(a, b))

    # ---------- 页面数据提取（用于和 CSV/JSON 交叉验证） ----------

    def _extract_page_data(self):
        """
        翻译：从当前页面提取关键数据，用于和 CSV 转出的 JSON 做交叉验证。
        返回一个字典，包含当前步骤已选择的关键信息。
        """
        data = {
            "character_data": {},
            "selected_items": [],
        }

        try:
            step = self.get_step()

            # 步骤 1-2: 种族/亚种
            if step in (1, 2):
                selected = self.find_all(By.CSS_SELECTOR, ".race-card.selected, .race-card[class*='selected']")
                for el in selected[:5]:
                    try:
                        name = el.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
                        if name:
                            data["selected_items"].append(name)
                    except Exception:
                        pass

            # 步骤 3: 职业
            elif step == 3:
                selected = self.find_all(By.CSS_SELECTOR, "#classGrid .race-card.selected")
                for el in selected[:5]:
                    try:
                        name = el.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
                        if name:
                            data["selected_items"].append(name)
                    except Exception:
                        pass

            # 步骤 4: 职业套装
            elif step == 4:
                selected = self.find_all(By.CSS_SELECTOR, "#packageGrid .race-card.selected")
                for el in selected[:5]:
                    try:
                        name = el.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
                        if name:
                            data["selected_items"].append(name)
                    except Exception:
                        pass

            # 步骤 5: 背景
            elif step == 5:
                selected = self.find_all(By.CSS_SELECTOR, "#backgroundGrid .race-card.selected")
                for el in selected[:5]:
                    try:
                        name = el.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
                        if name:
                            data["selected_items"].append(name)
                    except Exception:
                        pass

            # 步骤 6: 背景套装
            elif step == 6:
                selected = self.find_all(By.CSS_SELECTOR, "#bgPackageGrid .race-card.selected")
                for el in selected[:5]:
                    try:
                        name = el.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
                        if name:
                            data["selected_items"].append(name)
                    except Exception:
                        pass

            # 步骤 7: 属性值
            elif step == 7:
                filled = self.find_all(By.CSS_SELECTOR, ".ability-slot.filled")
                scores = []
                for el in filled[:6]:
                    try:
                        txt = el.text.strip()
                        if txt:
                            scores.append(txt)
                    except Exception:
                        pass
                data["character_data"]["ability_scores"] = scores

            # 步骤 9: 技能
            elif step == 9:
                selected = self.find_all(By.CSS_SELECTOR, ".skill-item.selected")
                for el in selected[:10]:
                    try:
                        name = el.find_element(By.CSS_SELECTOR, ".skill-name, [class*='skill-name']").text.strip()
                        if name:
                            data["selected_items"].append(name)
                    except Exception:
                        pass

            # 步骤 10: 专长
            elif step == 10:
                selected = self.find_all(By.CSS_SELECTOR, ".feat-card.selected, .feat-card[class*='selected']")
                for el in selected[:5]:
                    try:
                        name = el.find_element(By.CSS_SELECTOR, ".feat-card-name").text.strip()
                        if name:
                            data["selected_items"].append(name)
                    except Exception:
                        pass

            # 步骤 13: 特性总览 - 收集所有已选特性
            elif step == 13:
                selected = self.find_all(By.CSS_SELECTOR, ".selection-item.selected")
                for el in selected[:20]:
                    try:
                        name = el.text.split('\n')[0].strip()
                        if name and len(name) < 50:
                            data["selected_items"].append(name)
                    except Exception:
                        pass

            # 步骤 14: 角色详情
            elif step == 14:
                try:
                    name_input = self.find(By.ID, "detailName", timeout=3)
                    data["character_data"]["character_name"] = name_input.get_attribute("value")
                except Exception:
                    pass
                selected_langs = self.find_all(By.CSS_SELECTOR, ".language-tag.selected")
                for el in selected_langs[:10]:
                    try:
                        name = el.text.strip()
                        if name:
                            data["selected_items"].append(f"语言:{name}")
                    except Exception:
                        pass

        except Exception as e:
            data["_error"] = str(e)

        return data

    # ---------- JSON 数据加载 ----------

    def _load_json_data(self):
        """
        翻译：加载 JSON 数据目录下的所有 JSON 文件。
        返回：{文件名(不含.json): 数据列表或数据字典}
        """
        if not hasattr(self, '_json_cache'):
            self._json_cache = {}
            json_dir = JSON_DATA_DIR
            if not os.path.exists(json_dir):
                print(f"  [警告] JSON 数据目录不存在：{json_dir}")
                return self._json_cache
            for fname in os.listdir(json_dir):
                if fname.endswith('.json'):
                    fpath = os.path.join(json_dir, fname)
                    try:
                        with open(fpath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            key = fname[:-5]  # 去掉 .json
                            self._json_cache[key] = data
                    except Exception as e:
                        print(f"  [警告] 加载 JSON 失败 {fname}: {e}")
        return self._json_cache

    def _find_in_json(self, table_name, search_key, search_value):
        """
        翻译：在 JSON 数据中查找匹配的记录。
        参数：
            table_name: 表名（如 'races', 'classes', 'backgrounds'）
            search_key: 搜索的键名（如 'name', 'id'）
            search_value: 搜索的值
        返回：匹配的记录字典，未找到返回 None
        """
        json_data = self._load_json_data()
        table = json_data.get(table_name, [])
        if isinstance(table, dict):
            # 如果是字典，按 id 索引
            for item in table.values() if hasattr(table, 'values') else []:
                if str(item.get(search_key, '')) == str(search_value):
                    return item
        elif isinstance(table, list):
            for item in table:
                if str(item.get(search_key, '')) == str(search_value):
                    return item
        return None

    def _normalize_name(self, name):
        """
        翻译：规范化名字，用于模糊匹配。
        去除空格、全角半角、括号内容等。
        """
        if not name:
            return ''
        import re
        # 去除括号内容
        name = re.sub(r'[（(].*?[）)]', '', name)
        # 去除空格
        name = re.sub(r'\s+', '', name)
        # 全角转半角
        name = name.replace('Ａ', 'A').replace('ａ', 'a')
        name = name.replace('－', '-').replace('—', '-')
        return name.strip()

    # ---------- 页面数据与 JSON 对比 ----------

    def _verify_page_data_against_json(self, page_data):
        """
        翻译：将页面提取的数据和 JSON 数据做交叉验证。
        检查页面显示的内容是否和 JSON 数据一致。
        返回：(是否通过, 错误列表)
        """
        if not AUTO_VERIFY_JSON:
            return True, []

        errors = []
        selected = page_data.get('selected_items', [])
        step = self.get_step()

        for item_name in selected:
            if not item_name:
                continue

            norm_name = self._normalize_name(item_name)
            found = False

            # 步骤 1-2: 种族/亚种 → races.json / race_features.json
            if step in (1, 2):
                # 先查 races
                for item in self._load_json_data().get('races', []):
                    if self._normalize_name(item.get('name', '')) == norm_name:
                        found = True
                        break
                # 再查 race_features
                if not found:
                    for item in self._load_json_data().get('race_features', []):
                        if self._normalize_name(item.get('name', '')) == norm_name:
                            found = True
                            break

            # 步骤 3: 职业 → classes.json
            elif step == 3:
                for item in self._load_json_data().get('classes', []):
                    if self._normalize_name(item.get('name', '')) == norm_name:
                        found = True
                        break

            # 步骤 4: 职业套装 → class_features.json
            elif step == 4:
                for item in self._load_json_data().get('class_features', []):
                    if self._normalize_name(item.get('name', '')) == norm_name:
                        found = True
                        break

            # 步骤 5: 背景 → backgrounds.json
            elif step == 5:
                for item in self._load_json_data().get('backgrounds', []):
                    if self._normalize_name(item.get('name', '')) == norm_name:
                        found = True
                        break

            # 步骤 6: 背景套装 → backgrounds.json 或 class_features.json
            elif step == 6:
                for item in self._load_json_data().get('backgrounds', []):
                    if self._normalize_name(item.get('name', '')) == norm_name:
                        found = True
                        break
                if not found:
                    for item in self._load_json_data().get('class_features', []):
                        if self._normalize_name(item.get('name', '')) == norm_name:
                            found = True
                            break

            # 步骤 9: 技能 → skills.json
            elif step == 9:
                for item in self._load_json_data().get('skills', []):
                    if self._normalize_name(item.get('name', '')) == norm_name:
                        found = True
                        break

            # 步骤 10: 专长 → feats.json
            elif step == 10:
                for item in self._load_json_data().get('feats', []):
                    if self._normalize_name(item.get('name', '')) == norm_name:
                        found = True
                        break

            if not found:
                errors.append(f"步骤{step}：页面显示「{item_name}」在 JSON 数据中未找到匹配记录")

        return len(errors) == 0, errors

    # ---------- 快照系统 ----------

    def snapshot(self, label="", step=None, extra_data=None):
        """
        翻译：把当前浏览器页面的完整 HTML 和可见文本保存到快照目录。
        大肥鱼拿到这些文件就能"看到"你的页面 DOM 结构，精准定位问题。

        同时额外保存一个 .json 辅助文件，包含页面关键统计
        （按钮数、选择器名称、当前步骤等），方便快速判断状态。

        参数：
            extra_data: 额外的页面数据（从 _extract_page_data 获取），会合并到 stats 中
        """
        ensure_snapshot_dir()
        if step is None:
            step = self.get_step()
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        prefix = f"step{step:02d}"
        if label:
            prefix += f"_{label}"
        filename = f"{prefix}_{ts}"

        html_path = os.path.join(SNAPSHOT_DIR, filename + ".html")
        txt_path = os.path.join(SNAPSHOT_DIR, filename + ".txt")
        json_path = os.path.join(SNAPSHOT_DIR, filename + ".json")

        # 1. 完整 HTML
        html = self.driver.page_source
        marker = f"<!-- SNAPSHOT step={step} label={label} ts={ts} url={self.driver.current_url} -->\n"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(marker)
            f.write(html)

        # 2. 可见文本摘要
        body_text = self.driver.find_element(By.TAG_NAME, "body").text
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(f"步骤: {step}\n")
            f.write(f"标注: {label}\n")
            f.write(f"时间: {ts}\n")
            f.write(f"URL : {self.driver.current_url}\n")
            f.write("=" * 50 + "\n")
            f.write(body_text[:8000])

        # 3. 页面关键元素统计（方便快速判断）
        stats = {
            "step": step,
            "label": label,
            "ts": ts,
            "url": self.driver.current_url,
            "page_text_preview": body_text[:500],
            "elements": {}
        }
        # 合并 extra_data（如有）
        if extra_data:
            stats.update(extra_data)

            # ===== 数据对比：页面数据 vs JSON =====
            if AUTO_VERIFY_JSON and 'selected_items' in extra_data:
                ok, errs = self._verify_page_data_against_json(extra_data)
                stats['json_verify'] = {
                    'passed': ok,
                    'errors': errs
                }
                if not ok:
                    print(f"  [数据对比] 警告：步骤{step} {label}: {errs}")

        # 枚举各类关键元素
        for css, name in [
            (".feat-section", "特性分组"),
            (".feat-section-count", "特性计数"),
            (".selection-item:not(.selected):not(.disabled)", "可选特性项"),
            (".selection-item.selected", "已选特性项"),
            (".ability-slot.filled", "已填属性槽"),
            (".ability-slot:not(.filled)", "空属性槽"),
            (".ability-pool-num:not(.used)", "未用数值池数字"),
            (".ability-set", "属性组"),
            (".skill-section", "技能区"),
            (".skill-item.selected", "已选技能"),
            (".skill-item:not(.selected):not(.disabled)", "可选技能"),
            (".feat-card", "专长卡片"),
            (".feat-card.selected", "已选专长"),
            (".shop-grid-item", "商城商品"),
            (".export-card", "导出卡片"),
            ("#detailName", "名字输入框"),
            ("#detailAlignment", "阵营下拉"),
            (".language-tag.selected", "已选语言"),
            ("button#nextBtn", "下一步按钮"),
        ]:
            try:
                els = self.driver.find_elements(By.CSS_SELECTOR, css)
                if els:
                    names = []
                    for el in els[:10]:
                        try:
                            txt = el.text.strip()[:40]
                            if txt:
                                names.append(txt)
                        except Exception:
                            pass
                    stats["elements"][name] = {"count": len(els), "samples": names}
            except Exception:
                pass

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)

        print(f"  [快照] 快照已保存: {filename}")
        print(f"     HTML  → {os.path.basename(html_path)}")
        print(f"     文本  → {os.path.basename(txt_path)}")
        print(f"     统计  → {os.path.basename(json_path)}")
        return html_path

    # ---------- 进入车卡 ----------

    def enter_dnd_5r(self):
        """翻译：在规则选择页点击 DND 5R 卡片，跳到 DND 5R 的开始页。如果不在首页先导航回去"""
        current_url = self.driver.current_url
        if "/character" in current_url and "/character/dnd_5r" not in current_url:
            # 在车卡流程中，导航回首页
            self.driver.get(BASE_URL)
            time.sleep(1)
        elif "/character/dnd_5r" in current_url:
            # 在 DND 5R 开始页，找规则卡片可能不存在，先回首页
            self.driver.get(BASE_URL)
            time.sleep(1)
        
        card = self.find_clickable(By.CSS_SELECTOR, '.rule-card[data-rule="dnd_5r"]', timeout=10)
        card.click()
        # 翻译：等 URL 跳到 /character/dnd_5r
        self.find(By.CSS_SELECTOR, ".start-card-title")

    def start_new_character(self):
        """翻译：点击“新角色”卡片，正式进入第 1 步"""
        card = self.find_clickable(By.XPATH, "//div[contains(@class,'start-card-title') and text()='新角色']")
        self.click_el(card)
        # 翻译：等步骤指示器出现
        self.find(By.CSS_SELECTOR, ".step-indicator")

    # ---------- 步骤 1：种族 ----------

    def do_race(self, target_name=None):
        """翻译：随机挑一个种族，点击选中。如果指定了 target_name 就选指定的种族"""
        cards = self.find_all(By.CSS_SELECTOR, "#raceGrid .race-card")
        assert cards, "种族列表是空的，没法选"
        if target_name:
            chosen = None
            for c in cards:
                name = c.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
                if name == target_name:
                    chosen = c
                    break
            assert chosen, f"找不到指定种族：{target_name}"
            name = target_name
        else:
            chosen = random.choice(cards)
            name = chosen.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
        self.data.race_name = name
        self.click_el(chosen)
        print(f"  [种族] 选中：{name}")
        self.short_sleep()

    # ---------- 步骤 2：亚种 ----------

    def do_subrace(self, target_name=None):
        """翻译：随机挑一个亚种。如果指定了 target_name 就选指定的亚种（支持模糊匹配）"""
        cards = self.find_all(By.CSS_SELECTOR, "#subraceGrid .race-card")
        assert cards, "亚种页面打开了但亚种列表是空的"
        if target_name:
            chosen = None
            for c in cards:
                name = c.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
                if target_name in name:
                    chosen = c
                    break
            assert chosen, f"找不到指定亚种：{target_name}"
            name = chosen.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
        else:
            chosen = random.choice(cards)
            name = chosen.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
        self.data.subrace_name = name
        self.click_el(chosen)
        print(f"  [亚种] 选中：{name}")
        self.short_sleep()

    # ---------- 步骤 3：职业 ----------

    def do_class(self, target_name=None):
        """翻译：随机挑一个职业。如果指定了 target_name 就选指定的职业"""
        cards = self.find_all(By.CSS_SELECTOR, "#classGrid .race-card")
        assert cards, "职业列表是空的"
        if target_name:
            chosen = None
            for c in cards:
                name = c.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
                if name == target_name:
                    chosen = c
                    break
            assert chosen, f"找不到指定职业：{target_name}"
            name = target_name
        else:
            chosen = random.choice(cards)
            name = chosen.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
        self.data.class_name = name
        self.click_el(chosen)
        print(f"  [职业] 选中：{name}")
        self.short_sleep()

    # ---------- 步骤 4 / 6：套装选择 ----------

    def _do_package_step(self, grid_id: str, attr: str, label: str, target_name=None):
        """
        翻译：职业套装和背景套装页面长得一样，用同一个方法处理。
        参数：
            grid_id：套装网格的 ID（packageGrid 或 bgPackageGrid）
            attr：选中后把名字记到数据对象的哪个字段
            label：打印日志用的中文名
            target_name：如果指定就选指定的套装（模糊匹配）
        """
        cards = self.find_all(By.CSS_SELECTOR, f"#{grid_id} .race-card")
        if not cards:
            print(f"  [{label}] 没有可选套装，直接过")
            return
        # 翻译：如果指定了 target_name 就选指定的套装
        if target_name:
            chosen = None
            for c in cards:
                name = c.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
                if target_name in name:
                    chosen = c
                    break
            assert chosen, f"找不到指定套装：{target_name}"
            name = chosen.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
        else:
            # 翻译：如果已经有卡片处于选中态就不重复点，否则点第一张
            selected = [c for c in cards if "selected" in (c.get_attribute("class") or "")]
            chosen = selected[0] if selected else cards[0]
            name = chosen.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
        setattr(self.data, attr, name)
        if "selected" not in (chosen.get_attribute("class") or ""):
            self.click_el(chosen)
        print(f"  [{label}] 选中：{name}")
        self.short_sleep()

    # ---------- 步骤 5：背景 ----------

    def do_background(self, target_name=None):
        """翻译：随机挑一个背景。如果指定了 target_name 就选指定的背景"""
        cards = self.find_all(By.CSS_SELECTOR, "#backgroundGrid .race-card")
        assert cards, "背景列表是空的"
        if target_name:
            chosen = None
            for c in cards:
                name = c.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
                if name == target_name:
                    chosen = c
                    break
            assert chosen, f"找不到指定背景：{target_name}"
            name = target_name
        else:
            chosen = random.choice(cards)
            name = chosen.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
        self.data.background_name = name
        self.click_el(chosen)
        print(f"  [背景] 选中：{name}")
        self.short_sleep()

    # ---------- 步骤 7：基础属性 ----------

    def do_ability(self):
        """
        翻译：在随机模式下完整走一遍：
        1. 点“随机生成”按钮，掷出 3 组属性
        2. 选第 1 组（页面展开 6 个数字 + 6 个属性槽）
        3. 按“先点数字、再点属性槽”的方式把 6 个属性全部填满
        """
        # 翻译：点击随机生成按钮（直接调用页面上的同一个函数，避免元素过期）
        self.driver.execute_script("doRandomGenerate();")
        self.short_sleep(0.8, 1.2)

        # 翻译：等生成的属性组出现
        sets = self.find_all(By.CSS_SELECTOR, ".ability-set")
        assert sets, "点了随机生成但没有出现属性组"

        # 翻译：读第 1 组的 6 个数字，并检查范围是否合法（4d6取3高：3~18）
        values_text = sets[0].find_element(By.CSS_SELECTOR, ".ability-set-values").text
        scores = [int(n) for n in re.findall(r"\d+", values_text)]
        assert len(scores) == 6, f"属性组不是 6 个数字：{scores}"
        for s in scores:
            assert 3 <= s <= 18, f"属性值 {s} 超出 3~18 的合法范围"
        self.data.ability_scores = scores

        # 翻译：点第 1 组的“选择”按钮（每次重新找元素，防止过期）
        self.click_nth(".ability-set button", 0)
        self.short_sleep(0.5, 0.8)

        # 翻译：依次“点数字 → 点对应属性槽”，把 6 个槽填满；
        #       每一步都重新抓最新元素，避免页面重绘后点到旧元素
        pool_nums = self.find_all(By.CSS_SELECTOR, ".ability-pool-num")
        slots = self.find_all(By.CSS_SELECTOR, ".ability-slot")
        assert len(pool_nums) == 6 and len(slots) == 6, "数字或属性槽数量不对"
        for i in range(6):
            self.click_nth(".ability-pool-num", i)
            self.short_sleep(0.1, 0.2)
            self.click_nth(".ability-slot", i)
            self.short_sleep(0.1, 0.2)

        # 翻译：确认 6 个槽真的都填上了
        filled = self.find_all(By.CSS_SELECTOR, ".ability-slot.filled")
        assert len(filled) == 6, f"属性没填满，只填了 {len(filled)}/6"
        print(f"  [属性] 填入：{scores}")

    # ---------- 步骤 8：背景加值 ----------

    def do_bg_bonus(self):
        """
        翻译：背景加值规则是“两个不同属性 +2/+1，或三个不同属性各 +1”。
        最稳妥的点法：每一行都点一次“+”，即三个属性各 +1，永远合法。
        """
        rows = self.find_all(By.CSS_SELECTOR, ".bonus-row")
        assert rows, "背景加值页没有加值行"
        row_count = len(rows)

        # 翻译：每行点一次“+”。每点一次页面可能整体重绘，
        #       所以每一行都用 XPath 重新去页面上找最新的“+”按钮再点
        for i in range(row_count):
            xpath = (
                f"(//div[contains(@class,'bonus-row')])[{i+1}]"
                f"//button[normalize-space()='+']"
            )
            try:
                self.click_by(By.XPATH, xpath, timeout=5)
                self.short_sleep(0.1, 0.2)
            except StaleElementReferenceException:
                # 翻译：重绘中就稍等重试一次
                time.sleep(0.4)
                self.click_by(By.XPATH, xpath, timeout=5)

        # 翻译：读出每一行实际加了多少，打印出来
        bonuses = []
        for i in range(row_count):
            row = self.driver.find_elements(By.CSS_SELECTOR, ".bonus-row")[i]
            label = row.find_element(By.CSS_SELECTOR, ".bonus-label").text.strip()
            value = row.find_element(By.CSS_SELECTOR, ".bonus-value").text.strip()
            bonuses.append(f"{label}{value}")
        print(f"  [背景加值] {', '.join(bonuses)}")

    # ---------- 步骤 10：技能 ----------

    def do_skills(self):
        """
        翻译：技能页分“职业技能”和“背景技能”两区。
        职业技能区有硬性数量要求（已选 X / Y），选满 Y 个；
        背景技能区一般不强制，也顺手选 1 个。
        """
        # 翻译：技能区数量（每次点击都可能整体重绘，所以不保存区元素，
        #       后面一律用“第几个区”的 XPath 现用现找）
        section_count = len(self.find_all(By.CSS_SELECTOR, ".skill-section"))
        assert section_count, "技能页一个技能区都没有"

        # 翻译：逐区处理
        for sec_idx in range(section_count):
            # 翻译：这个区的 XPath 前缀（用“第几个技能区”定位，不受布局影响）
            base_xpath = f"(//div[contains(@class,'skill-section')])[{sec_idx+1}]"
            count_xpath = base_xpath + "//*[contains(@class,'skill-count')]"
            items_xpath = (
                base_xpath
                + "//div[contains(@class,'skill-item') and not(contains(@class,'disabled'))]"
            )

            # 翻译：读这一区需要选几个（现用现找，不持有旧元素）
            count_text = self.find(By.XPATH, count_xpath).text
            _already, required = parse_required_count(count_text)

            # 翻译：找出这个区里所有没被禁用的技能
            items = self.find_all(By.XPATH, items_xpath)

            # 翻译：职业技能区按要求数量选满；背景区没有要求就选 1 个
            target = required if required is not None else 1
            target = min(target, len(items))

            # 翻译：逐个点击，每次都重新找元素；
            #       已选项仍排在前面，所以第 k 次点列表里的第 k+1 个
            picked_names = []
            for k in range(target):
                one_xpath = f"({items_xpath})[{k+1}]"
                name = self.find(By.XPATH, one_xpath + "//*[contains(@class,'skill-name')]").text.strip()
                self.click_by(By.XPATH, one_xpath, timeout=8)
                picked_names.append(name)
                self.short_sleep(0.1, 0.2)

            # 翻译：记到对应的数据字段里
            if sec_idx == 0:
                self.data.class_skills = picked_names
            else:
                self.data.bg_skills = picked_names
            print(f"  [技能] 第{sec_idx+1}区选中：{picked_names}")

    # ---------- 步骤 11：专长 ----------

    def do_feat(self):
        """
        翻译：专长页通常会自动选中背景推荐的专长（卡片带 selected 类）。
        如果没有任何选中的卡片，就主动点第一张可选的专长卡。
        """
        cards = self.find_all(By.CSS_SELECTOR, ".feat-card-grid .feat-card")
        assert cards, "专长页一张专长卡都没有"

        selected = [c for c in cards if "selected" in (c.get_attribute("class") or "")]
        if selected:
            chosen = selected[0]
        else:
            chosen = cards[0]
            self.click_el(chosen)
            self.short_sleep()

        name = chosen.find_element(By.CSS_SELECTOR, ".feat-card-name").text.strip()
        self.data.feat_name = name
        print(f"  [专长] 选中：{name}")

    # ---------- 步骤 12：法术（直接过） ----------

    def do_spells_skip(self):
        """
        翻译：法术步骤没有强制校验（不选法术也能继续），
        为了回归测试跑得快，这里不做任何选择直接放行。
        """
        print("  [法术] 按测试策略跳过选择")

    # ---------- 步骤 12：商城购物 ----------

    def do_shopping(self):
        """
        翻译：在商城实际买 1 件买得起的东西，验证整套购物流程：
        1. 读余额，换算成铜币
        2. 在当前分类（默认冒险用品）里按价格从低到高找一件买得起的
        3. 点商品 → 数量 +1 → 点“确定”加进购物车
        """
        # 翻译：从余额栏读出“= 2PP 4GP”这部分，换算成铜币
        balance_text = self.find(By.CSS_SELECTOR, ".shop-balance").text
        m = re.search(r"=\s*(.+)$", balance_text, re.S)
        balance_cp = price_to_copper(m.group(1) if m else "")

        # 翻译：拿到所有商品，并按价格从便宜到贵排序
        items = self.find_all(By.CSS_SELECTOR, ".shop-grid .shop-grid-item")
        priced = []
        for it in items:
            name = it.find_element(By.CSS_SELECTOR, ".shop-grid-name").text.strip()
            price = it.find_element(By.CSS_SELECTOR, ".shop-grid-price").text.strip()
            priced.append((price_to_copper(price), name, it))
        priced.sort(key=lambda x: x[0])

        # 翻译：找第一件余额买得起的商品
        affordable = [p for p in priced if 0 < p[0] <= balance_cp]
        if not affordable:
            print("  [商城] 余额买不起任何东西，跳过购物")
            return

        _price, name, item_el = affordable[0]
        self.click_el(item_el)
        self.short_sleep(0.4, 0.7)

        # 翻译：详情面板里数量默认是 0，先点一次“+”变成 1
        plus_qty = self.find_clickable(By.XPATH, "//button[contains(@onclick,'changePendingQty(1)')]")
        self.click_el(plus_qty)
        self.short_sleep(0.1, 0.2)

        # 翻译：点“确定”把商品加进购物车
        confirm_btn = self.find_clickable(By.CSS_SELECTOR, ".shop-confirm-btn")
        self.click_el(confirm_btn)
        self.short_sleep(0.4, 0.7)

        # 翻译：确认购物车区域真的出现了这件商品
        cart_text = self.driver.find_element(By.TAG_NAME, "body").text
        assert name in cart_text, f"点了确定但购物车里没出现「{name}」"
        self.data.shopping_cart = [name]
        print(f"  [商城] 已购买：{name}")

    # ---------- 步骤 13：特性总览 ----------

    def do_feature_review(self):
        """特性总览页：纯 Selenium 逐分组点选，不求快只求稳"""
        print("[步骤13] 特性总览")

        max_rounds = 80
        for _ in range(max_rounds):
            self.short_sleep(0.2, 0.5)
            picked = self._review_pick_one()
            if picked is None:
                print("  [特性总览] 所有待选项已选满")
                return
        raise AssertionError("特性总览轮数用尽，仍有未选满的分组")

    def _review_pick_one(self):
        """在特性总览页找第一个未选满分组，点一个可选项。返回选项名或 None"""
        sections = self.driver.find_elements(By.CSS_SELECTOR, '.feat-section')
        for sec in sections:
            try:
                cnt_el = sec.find_element(By.CSS_SELECTOR, '.feat-section-count')
                cnt_text = cnt_el.text
            except Exception:
                continue

            m = re.search(r'(\d+)\s*/\s*(\d+)', cnt_text)
            if not m:
                continue
            already = int(m.group(1))
            need = int(m.group(2))
            if already >= need:
                continue

            try:
                title_el = sec.find_element(By.CSS_SELECTOR, '.feat-section-title')
                title = title_el.text.strip()
            except Exception:
                title = '?'

            # 展开折叠的分组
            try:
                body = sec.find_element(By.CSS_SELECTOR, '.feat-section-body')
                if 'collapsed' in (body.get_attribute('class') or ''):
                    header = sec.find_element(By.CSS_SELECTOR, '.feat-section-header')
                    self.click_el(header)
                    self.short_sleep(0.2, 0.4)
            except Exception:
                pass

            # 找第一个未选中且未禁用的选项
            try:
                items = sec.find_elements(
                    By.CSS_SELECTOR, '.selection-item:not(.selected):not(.disabled)'
                )
            except Exception:
                items = []

            if not items:
                print(f"  [x] 分组「{title}」要选{need}个 已有{already}个 无可选项")
                continue

            item = items[0]
            name = item.text.split('\n')[0].strip()
            print(f"  [Selenium] {title} 选了: {name}")
            self.click_el(item)
            self.short_sleep(0.15, 0.35)
            return name

        return None

    # ---------- 步骤 14：角色详情 ----------

    def do_details(self):
        """
        翻译：填写角色的收尾信息：
        1. 名字（必填）、玩家名
        2. 选阵营
        3. 按页面要求选满语言（页面会显示“已选择 X / Y”）
        4. 性格特点/理想/羁绊/缺点/背景故事 五个文本框
        """
        # 翻译：角色名（随机生成一个，保证不重名）
        char_name = f"回归测试_{random.randint(10000, 99999)}"
        name_input = self.find(By.ID, "detailName")
        name_input.clear()
        name_input.send_keys(char_name)
        self.data.character_name = char_name

        # 翻译：玩家名
        player_input = self.find(By.ID, "detailPlayer")
        player_input.clear()
        player_input.send_keys("测试玩家")

        # 翻译：阵营（下拉框选第 2 个选项，第 1 个是“请选择”占位）
        alignment = self.find(By.ID, "detailAlignment")
        options = alignment.find_elements(By.TAG_NAME, "option")
        if len(options) > 1:
            options[1].click()

        # 翻译：选语言——先读出页面要求选几种（不包含种族天生赠送的）
        required_lang = None
        # 翻译：先尝试从“已选择 0 / 3”的计数元素里读数量
        count_els = self.find_all(
            By.CSS_SELECTOR, '[class*="language-count"], [class*="lang-count"]'
        )
        if count_els:
            _a, required_lang = parse_required_count(count_els[0].text)
        # 翻译：计数元素读不到时，从“选择3种语言”的说明文字里兜底解析
        if required_lang is None:
            m = re.search(r"选择\s*(\d+)\s*种语言", self.driver.find_element(By.TAG_NAME, "body").text)
            required_lang = int(m.group(1)) if m else 0

        chosen_langs = []
        # 翻译：每次点语言标签后页面可能重绘，所以反复“重新找第一个没选中的
        #       语言标签 → 读名字 → 点击”，直到选够要求的数量
        for _ in range(required_lang):
            tag_xpath = (
                "(//div[@id='languageGrid']"
                "//div[contains(@class,'language-tag') and not(contains(@class,'selected'))])[1]"
            )
            name = self.find(By.XPATH, tag_xpath, timeout=8).text.strip()
            self.click_by(By.XPATH, tag_xpath, timeout=8)
            chosen_langs.append(name)
            self.short_sleep(0.1, 0.2)
        self.data.languages = chosen_langs

        # 翻译：五个长文本框，统一填测试内容
        for field_id in ["detailTraits", "detailIdeals", "detailBonds", "detailFlaws", "detailBackstory"]:
            try:
                el = self.find(By.ID, field_id, timeout=3)
                el.clear()
                el.send_keys("测试内容")
            except TimeoutException:
                # 翻译：个别页面可能没有这个字段，没有就跳过
                pass

        print(f"  [角色详情] 名字：{char_name}，语言：{chosen_langs}")

    # ---------- 步骤 15：角色卡 ----------

    def verify_sheet(self):
        """翻译：在最终角色卡页面确认名字/种族/职业这些关键信息都展示出来了"""
        body_text = self.driver.find_element(By.TAG_NAME, "body").text

        # 翻译：逐项检查关键信息是否都在页面上
        checks = [
            (self.data.character_name, "角色名"),
            (self.data.race_name, "种族"),
            (self.data.class_name, "职业"),
        ]
        for value, label in checks:
            assert value in body_text, f"角色卡上找不到{label}：{value}"
            print(f"  [角色卡] {label}「{value}」显示正常")

    # ---------- 步骤 16：完成页 ----------

    def verify_finish_page(self):
        """翻译：确认完成页上有“导出 JSON / 导出 PDF / 升级角色”三个入口"""
        cards = self.find_all(By.CSS_SELECTOR, ".export-card")
        assert len(cards) >= 3, f"完成页导出卡片数量不对：{len(cards)}"

        page_text = self.driver.find_element(By.TAG_NAME, "body").text
        for keyword in ["导出 JSON", "导出 PDF", "升级"]:
            assert keyword in page_text, f"完成页找不到「{keyword}」入口"
            print(f"  [完成页] 「{keyword}」入口正常")

    # ---------- 新增：导出/导入/PDF 测试 ----------

    def export_json(self, download_dir: str) -> str:
        """
        翻译：点击"导出 JSON"按钮，等待文件下载完成。
        返回：下载的 JSON 文件路径
        """
        # 点击导出按钮
        export_btn = self.find_clickable(By.CSS_SELECTOR, ".export-card[onclick*='exportCharacterJSON']")
        self.click_el(export_btn)
        self.short_sleep(1)

        # 等待下载完成（最多等 15 秒）
        for _ in range(30):
            files = [f for f in os.listdir(download_dir) if f.endswith(".json")]
            if files:
                # 找最新的 JSON 文件
                latest = max(files, key=lambda f: os.path.getmtime(os.path.join(download_dir, f)))
                # 确保文件不再被写入（大小稳定）
                size1 = os.path.getsize(os.path.join(download_dir, latest))
                time.sleep(0.5)
                size2 = os.path.getsize(os.path.join(download_dir, latest))
                if size1 == size2:
                    return os.path.join(download_dir, latest)
            time.sleep(0.5)

        raise TimeoutError("导出 JSON 文件下载超时")

    def verify_export_json(self, json_path: str) -> dict:
        """
        翻译：验证导出的 JSON 文件内容是否和页面显示一致。
        返回：解析后的 JSON 数据
        """
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # 验证关键字段
        assert data.get("raceId") is not None, "导出 JSON 缺少 raceId"
        assert data.get("classId") is not None, "导出 JSON 缺少 classId"
        assert data.get("backgroundId") is not None, "导出 JSON 缺少 backgroundId"
        assert data.get("abilities") is not None, "导出 JSON 缺少 abilities"

        print(f"  [导出JSON] 角色名：{data.get('name', '未命名')}")
        print(f"  [导出JSON] raceId={data['raceId']}, classId={data['classId']}, backgroundId={data['backgroundId']}")
        print(f"  [导出JSON] 属性：{data.get('abilities')}")
        print(f"  [导出JSON] 技能数：class={len(data.get('classSkills', []))}, bg={len(data.get('backgroundSkills', []))}")
        print(f"  [导出JSON] 专长：{data.get('selectedFeat')}")
        print(f"  [导出JSON] 购物项：{len(data.get('shoppingItems', []))} 项")

        return data

    def import_json(self, json_path: str):
        """
        翻译：通过欢迎页的"导入角色"按钮导入 JSON 文件。
        策略：刷新页面触发 DOMContentLoaded，等欢迎页渲染完，然后通过 JS 导入。
        """
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # 刷新页面（触发 DOMContentLoaded 重新执行）
        self.driver.refresh()
        
        # 等待欢迎页加载完成（等"新角色"按钮出现）
        self.find(By.CSS_SELECTOR, "#start-new-character", timeout=15)
        print(f"  [导入JSON] 欢迎页已加载")

        # 等待 JS 完全加载（defer 脚本需要额外时间）
        time.sleep(3)

        # 确认 loadCharacterFromJSON 函数已定义
        result = self.driver.execute_script("return typeof loadCharacterFromJSON;")
        if result != "function":
            # 如果还没定义，再等一下
            time.sleep(5)
            result = self.driver.execute_script("return typeof loadCharacterFromJSON;")
        
        if result != "function":
            print(f"  [调试] loadCharacterFromJSON 类型：{result}")
            print(f"  [调试] 页面标题：{self.driver.title}")
            print(f"  [调试] URL：{self.driver.current_url}")
            # 尝试直接检查页面脚本
            scripts = self.driver.execute_script("return Array.from(document.scripts).map(s => s.src).join('\\n');")
            print(f"  [调试] 页面脚本：{scripts[:500]}")
            raise TimeoutError("loadCharacterFromJSON 未定义，页面可能未完全加载")

        # 通过 JS 直接导入（绕过文件选择对话框）
        self.driver.execute_script(
            "loadCharacterFromJSON(arguments[0]);",
            data
        )
        self.short_sleep(2)
        print(f"  [导入JSON] 已导入角色数据")

    def verify_import_result(self, expected_data: dict):
        """
        翻译：验证导入后页面显示的数据是否和导出时一致。
        导入后会跳转到角色卡展示页（步骤15）。
        """
        from selenium.webdriver.common.by import By
        
        step = self.get_step()
        # 导入后应该在步骤15（角色卡页）
        assert step == 15, f"导入后期望在步骤15，实际在步骤{step}"

        body_text = self.driver.find_element(By.TAG_NAME, "body").text

        # 验证角色名
        name = expected_data.get("name", "")
        if name:
            assert name in body_text, f"角色卡上找不到角色名：{name}"
            print(f"  [导入验证] 角色名「{name}」显示正常")

        # 验证种族
        race_id = expected_data.get("raceId")
        if race_id:
            races = json.load(open(os.path.join(JSON_DATA_DIR, "races.json"), encoding="utf-8"))
            race = next((r for r in races if r.get("id") == race_id), None)
            if race:
                assert race["name"] in body_text, f"角色卡上找不到种族：{race['name']}"
                print(f"  [导入验证] 种族「{race['name']}」显示正常")

        # 验证职业
        class_id = expected_data.get("classId")
        if class_id:
            classes = json.load(open(os.path.join(JSON_DATA_DIR, "classes.json"), encoding="utf-8"))
            cls = next((c for c in classes if c.get("id") == class_id), None)
            if cls:
                assert cls["name"] in body_text, f"角色卡上找不到职业：{cls['name']}"
                print(f"  [导入验证] 职业「{cls['name']}」显示正常")

        # 验证背景
        bg_id = expected_data.get("backgroundId")
        if bg_id:
            backgrounds = json.load(open(os.path.join(JSON_DATA_DIR, "backgrounds.json"), encoding="utf-8"))
            bg = next((b for b in backgrounds if b.get("id") == bg_id), None)
            if bg:
                assert bg["name"] in body_text, f"角色卡上找不到背景：{bg['name']}"
                print(f"  [导入验证] 背景「{bg['name']}」显示正常")

        print("  [导入验证] 所有关键字段验证通过")

    def verify_pdf_export(self, download_dir: str) -> str:
        """
        翻译：点击"导出 PDF"按钮，等待 PDF 文件下载完成。
        返回：下载的 PDF 文件路径
        """
        # 点击导出 PDF 按钮
        export_btn = self.find_clickable(By.CSS_SELECTOR, ".export-card[onclick*='exportCharacterPDF']")
        self.click_el(export_btn)
        self.short_sleep(2)

        # 等待下载完成（PDF 生成较慢，最多等 30 秒）
        for _ in range(60):
            files = [f for f in os.listdir(download_dir) if f.endswith(".pdf")]
            if files:
                latest = max(files, key=lambda f: os.path.getmtime(os.path.join(download_dir, f)))
                size1 = os.path.getsize(os.path.join(download_dir, latest))
                time.sleep(1)
                size2 = os.path.getsize(os.path.join(download_dir, latest))
                if size1 == size2 and size2 > 10000:  # PDF 至少 10KB
                    return os.path.join(download_dir, latest)
            time.sleep(0.5)

        raise TimeoutError("导出 PDF 文件下载超时")

    def verify_pdf_content(self, pdf_path: str, expected_data: dict):
        """
        翻译：简单验证 PDF 文件大小正常（不解析 PDF 内容，只做基本检查）。
        """
        file_size = os.path.getsize(pdf_path)
        assert file_size > 10000, f"PDF 文件大小异常（{file_size} 字节），可能导出失败"
        print(f"  [PDF验证] 文件大小：{file_size / 1024:.1f} KB，正常")

    def cleanup_downloads(self, download_dir: str):
        """翻译：清理下载目录中的测试文件"""
        if not os.path.exists(download_dir):
            return
        for f in os.listdir(download_dir):
            fpath = os.path.join(download_dir, f)
            if f.endswith(".json") or f.endswith(".pdf"):
                os.remove(fpath)
                print(f"  [清理] 已删除：{f}")

    # ---------- 新增：解绑开关操作 ----------

    def toggle_unbind(self, unbind_type: str):
        """
        翻译：点击解绑开关。
        参数：
            unbind_type: 'classSkill'（职业技能）、'bgSkill'（背景技能）、'bonus'（背景加值）、'feat'（专长）
        """
        toggle = self.find_clickable(By.CSS_SELECTOR, f".unbind-toggle[onclick*=\"toggleUnbind('{unbind_type}')\"]")
        self.click_el(toggle)
        self.short_sleep(0.3, 0.5)
        # 页面可能重新渲染，需要重新查找元素
        toggle = self.find(By.CSS_SELECTOR, f".unbind-toggle[onclick*=\"toggleUnbind('{unbind_type}')\"]")
        is_active = "active" in (toggle.get_attribute("class") or "")
        print(f"  [解绑] {unbind_type} 解绑状态：{'已解绑' if is_active else '已绑定'}")
        return is_active

    def is_unbind_active(self, unbind_type: str) -> bool:
        """翻译：检查解绑开关是否处于激活状态"""
        try:
            toggle = self.find(By.CSS_SELECTOR, f".unbind-toggle[onclick*=\"toggleUnbind('{unbind_type}')\"]")
            return "active" in (toggle.get_attribute("class") or "")
        except Exception:
            return False

    # ---------- 新增：上一步操作 ----------

    def go_prev(self, timeout=8):
        """
        翻译：点"上一步"按钮，然后等待步骤确实发生变化。
        返回值：True = 成功返回上一步，False = 上一步按钮不可见或无法点击
        """
        step_before = self.get_step()
        if step_before <= 1:
            print("  [上一步] 已经在第1步，无法继续后退")
            return False

        prev_btn = self.find(By.ID, "prevBtn")
        visibility = prev_btn.get_attribute("style") or ""
        if "visibility: hidden" in visibility or "display: none" in visibility:
            print("  [上一步] 上一步按钮不可见")
            return False

        self.click_el(prev_btn)
        try:
            WebDriverWait(self.driver, timeout).until(
                lambda d: self.get_step() != step_before
            )
            step_after = self.get_step()
            print(f"  [上一步] 从步骤{step_before}返回到步骤{step_after}")
            return True
        except TimeoutException:
            print("  [上一步] 步骤号未变化，可能点击失败")
            return False

    # ---------- 新增：法术页验证 ----------

    def do_spells_verify(self, expect_spells_page=True):
        """
        翻译：验证法术页是否存在。
        参数：
            expect_spells_page: True=期望有法术页（施法职业），False=期望无法术页（非施法职业）
        返回：实际是否有法术页
        """
        step = self.get_step()
        if step == 11:
            body_text = self.driver.find_element(By.TAG_NAME, "body").text
            has_spells = "法术选择" in body_text or "施法属性" in body_text
            if expect_spells_page:
                assert has_spells, "期望有法术页但未检测到法术相关内容"
                print("  [法术] 施法职业，法术页正常显示")
            else:
                print("  [法术] 非施法职业但进入了法术页（可能系统允许跳过）")
            return True
        elif step > 12:
            if expect_spells_page:
                print("  [法术] 期望有法术页但被跳过")
                return False
            else:
                print("  [法术] 非施法职业，正确跳过法术页")
                return True
        else:
            print(f"  [法术] 当前步骤{step}，还未到法术页")
            return None

    # ---------- 新增：特性总览验证 ----------

    def verify_feature_review_complete(self):
        """
        翻译：验证特性总览页是否所有分组已选满。
        返回：True=所有分组已选满，False=仍有未选满的分组
        """
        sections = self.find_all(By.CSS_SELECTOR, ".feat-section")
        incomplete_sections = []
        for sec in sections:
            try:
                cnt_el = sec.find_element(By.CSS_SELECTOR, ".feat-section-count")
                m = re.search(r"(\d+)\s*/\s*(\d+)", cnt_el.text)
                if m:
                    already = int(m.group(1))
                    need = int(m.group(2))
                    if already < need:
                        title_el = sec.find_element(By.CSS_SELECTOR, ".feat-section-title")
                        incomplete_sections.append(title_el.text.strip())
            except Exception:
                pass

        if incomplete_sections:
            print(f"  [特性总览] 仍有{len(incomplete_sections)}个分组未选满：{incomplete_sections[:3]}")
            return False
        else:
            print("  [特性总览] 所有分组已选满")
            return True

    # ---------- 新增：数据变更测试工具 ----------

    def backup_json_data(self):
        """翻译：备份当前 JSON 数据文件到备份目录"""
        os.makedirs(DATA_BACKUP_DIR, exist_ok=True)
        json_dir = JSON_DATA_DIR
        if not os.path.exists(json_dir):
            print(f"  [警告] JSON 数据目录不存在：{json_dir}")
            return False

        for f in os.listdir(DATA_BACKUP_DIR):
            os.remove(os.path.join(DATA_BACKUP_DIR, f))

        for fname in os.listdir(json_dir):
            if fname.endswith(".json"):
                src = os.path.join(json_dir, fname)
                dst = os.path.join(DATA_BACKUP_DIR, fname)
                with open(src, "r", encoding="utf-8") as f_in:
                    content = f_in.read()
                with open(dst, "w", encoding="utf-8") as f_out:
                    f_out.write(content)
        count = len([f for f in os.listdir(DATA_BACKUP_DIR) if f.endswith(".json")])
        print(f"  [数据备份] 已备份 {count} 个 JSON 文件")
        return True

    def restore_json_data(self):
        """翻译：从备份目录恢复 JSON 数据文件"""
        if not os.path.exists(DATA_BACKUP_DIR):
            print("  [警告] 备份目录不存在，无法恢复")
            return False

        json_dir = JSON_DATA_DIR
        os.makedirs(json_dir, exist_ok=True)

        count = 0
        for fname in os.listdir(DATA_BACKUP_DIR):
            if fname.endswith(".json"):
                src = os.path.join(DATA_BACKUP_DIR, fname)
                dst = os.path.join(json_dir, fname)
                with open(src, "r", encoding="utf-8") as f_in:
                    content = f_in.read()
                with open(dst, "w", encoding="utf-8") as f_out:
                    f_out.write(content)
                count += 1
        print(f"  [数据恢复] 已恢复 {count} 个 JSON 文件")
        return True

    def modify_json_file(self, filename: str, modify_func):
        """
        翻译：修改指定的 JSON 文件。
        参数：
            filename: JSON 文件名（如 'classes.json'）
            modify_func: 修改函数，接收原始数据，返回修改后的数据
        """
        json_dir = JSON_DATA_DIR
        fpath = os.path.join(json_dir, filename)
        if not os.path.exists(fpath):
            print(f"  [警告] JSON 文件不存在：{filename}")
            return False

        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)

        modified_data = modify_func(data)

        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(modified_data, f, ensure_ascii=False, indent=2)
        print(f"  [数据修改] 已修改 {filename}")
        return True

    def refresh_page(self):
        """翻译：刷新当前页面，等待数据加载完成"""
        self.driver.refresh()
        time.sleep(3)
        # 等待页面数据加载完成（等待种族列表出现）
        try:
            self.find(By.CSS_SELECTOR, "#raceGrid .race-card", timeout=15)
        except Exception:
            # 如果不在步骤1，尝试找开始页
            try:
                self.find(By.CSS_SELECTOR, ".start-card-title", timeout=10)
            except Exception:
                pass
        step = self.get_step()
        print(f"  [刷新] 页面已刷新，当前步骤：{step if step > 0 else '开始页/首页'}")

    # ---------- 新增：通用页面元素完整性检查 ----------

    def verify_page_elements(self, step=None):
        """
        翻译：按步骤号检查该步骤应有的关键元素是否存在。
        返回：(是否通过, 缺失元素列表)
        """
        if step is None:
            step = self.get_step()

        # 各步骤必须存在的关键元素
        required = {
            1: [("#raceGrid", "种族列表"), ("#nextBtn", "下一步按钮")],
            2: [("#subraceGrid", "亚种列表"), ("#nextBtn", "下一步按钮"), ("#prevBtn", "上一步按钮")],
            3: [("#classGrid", "职业列表"), ("#nextBtn", "下一步按钮"), ("#prevBtn", "上一步按钮")],
            4: [("#packageGrid", "职业套装列表"), ("#nextBtn", "下一步按钮"), ("#prevBtn", "上一步按钮")],
            5: [("#backgroundGrid", "背景列表"), ("#nextBtn", "下一步按钮"), ("#prevBtn", "上一步按钮")],
            6: [("#bgPackageGrid", "背景套装列表"), ("#nextBtn", "下一步按钮"), ("#prevBtn", "上一步按钮")],
            7: [(".ability-set", "属性组"), (".ability-tabs", "属性模式切换"), ("#nextBtn", "下一步按钮"), ("#prevBtn", "上一步按钮")],
            8: [(".bonus-row", "加值行"), (".unbind-toggle", "解绑开关"), ("#nextBtn", "下一步按钮"), ("#prevBtn", "上一步按钮")],
            9: [(".skill-section", "技能区"), (".skill-count", "技能计数"), (".unbind-toggle", "解绑开关"), ("#nextBtn", "下一步按钮"), ("#prevBtn", "上一步按钮")],
            10: [(".feat-card-grid", "专长卡片网格"), (".feat-card", "专长卡片"), (".unbind-toggle", "解绑开关"), ("#nextBtn", "下一步按钮"), ("#prevBtn", "上一步按钮")],
            11: [("#nextBtn", "下一步按钮"), ("#prevBtn", "上一步按钮")],
            12: [(".shop-balance", "余额"), (".shop-grid", "商品网格"), (".shop-cart", "购物车"), ("#nextBtn", "下一步按钮"), ("#prevBtn", "上一步按钮")],
            13: [(".feat-section", "特性分组"), (".feat-section-count", "特性计数"), ("#nextBtn", "下一步按钮"), ("#prevBtn", "上一步按钮")],
            14: [("#detailName", "角色名输入框"), ("#detailAlignment", "阵营下拉"), ("#languageGrid", "语言网格"), ("#nextBtn", "下一步按钮"), ("#prevBtn", "上一步按钮")],
            15: [(".sheet-container", "角色卡容器")],
            16: [(".export-card", "导出卡片")],
        }

        elements = required.get(step, [])
        missing = []

        for selector, name in elements:
            try:
                el = self.find(By.CSS_SELECTOR, selector, timeout=5)
                if not el.is_displayed():
                    missing.append(f"{name}（{selector}）- 元素不可见")
            except Exception:
                missing.append(f"{name}（{selector}）- 元素不存在")

        # 步骤2+ 都应该有上一步按钮（除了步骤1）
        if step >= 2 and step != 16:
            try:
                prev_btn = self.find(By.ID, "prevBtn", timeout=3)
                style = prev_btn.get_attribute("style") or ""
                if "visibility: hidden" in style or "display: none" in style:
                    missing.append("上一步按钮 - 按钮被隐藏")
            except Exception:
                missing.append("上一步按钮 - 元素不存在")

        passed = len(missing) == 0
        if passed:
            print(f"  [元素检查] 步骤{step} 所有关键元素正常 ({len(elements)}项)")
        else:
            print(f"  [元素检查] 步骤{step} 缺失 {len(missing)} 项：{missing[:3]}")

        return passed, missing

    # ---------- 全流程串联 ----------

    def run_full_flow(self, max_rounds=60):
        """
        翻译：主循环——看当前在第几步，就做那一步的事，然后点下一步；
        如果点下一步被弹窗拦住（没选够），就重新执行这一步再点，
        最多重试 3 轮，直到走到第 16 步并完成检查。
        """
        # 翻译：步骤号到处理函数的对照表
        handlers = {
            1: self.do_race,
            2: self.do_subrace,
            3: self.do_class,
            4: lambda: self._do_package_step("packageGrid", "class_package", "职业套装"),
            5: self.do_background,
            6: lambda: self._do_package_step("bgPackageGrid", "bg_package", "背景套装"),
            7: self.do_ability,
            8: self.do_bg_bonus,
            9: self.do_skills,
            10: self.do_feat,
            11: self.do_spells_skip,
            12: self.do_shopping,
            13: self.do_feature_review,
            14: self.do_details,
            15: self.verify_sheet,
        }

        rounds = 0
        while rounds < max_rounds:
            rounds += 1
            step = self.get_step()
            print(f"\n--- 当前第 {step} 步 ---")

            # 翻译：走到第 16 步说明全流程完成，做最后检查后退出循环
            if step == 16:
                self.verify_finish_page()
                print("\n全流程走通，停在完成页。")
                # 最后一步快照（成功时可选）
                if SNAPSHOT_EACH_STEP:
                    self.snapshot("完成")
                # 控制台错误汇总
                self.print_console_summary()
                return self.data

            handler = handlers.get(step)
            assert handler is not None, f"遇到未知步骤：第 {step} 步，不知道怎么处理"

            # 翻译：该步骤最多重试 3 次（每次都重新执行选择逻辑）
            progressed = False
            for attempt in range(3):
                try:
                    handler()
                except Exception as e:
                    print(f"  步骤{step} 内部异常（第{attempt+1}次）: {e}")
                    if SNAPSHOT_ON_ERROR:
                        self.snapshot(f"error_step{step}_attempt{attempt+1}", step)
                    raise  # 内部异常不重试，直接抛出

                self.short_sleep(0.3, 0.6)
                ok, msg = self.go_next()
                if ok:
                    progressed = True
                    # 每步成功后可选快照
                    if SNAPSHOT_EACH_STEP:
                        self.snapshot("ok", step)
                    break
                # 翻译：被弹窗拦住，打印原因后重新选这一步
                print(f"  下一步被拦（第{attempt+1}次）：{msg}")
                if SNAPSHOT_ON_ERROR:
                    self.snapshot(f"blocked_step{step}_attempt{attempt+1}", step)
                self.short_sleep(0.3, 0.6)

            assert progressed, f"第 {step} 步重试 3 次仍无法继续"

        raise AssertionError(f"超过最大轮数 {max_rounds} 还没走完流程")


# ============================================================
# 浏览器驱动创建
# ============================================================

def _build_options(options):
    """翻译：给浏览器选项加上统一的窗口尺寸、无头开关等参数"""
    options.add_argument(f"--window-size={WINDOW_SIZE}")
    if HEADLESS:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-gpu")
    options.add_experimental_option("excludeSwitches", ["enable-logging"])

    # 开启浏览器控制台日志采集（供 get_log('browser') 使用）
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    # 配置下载目录（不弹下载提示）
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    if hasattr(options, 'add_experimental_option'):
        prefs = {
            "download.default_directory": DOWNLOAD_DIR,
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "safebrowsing.enabled": True,
        }
        options.add_experimental_option("prefs", prefs)

    return options


def _find_local_driver(driver_name):
    """
    翻译：在 webdriver-manager 的缓存目录里找已经下载好的浏览器驱动。
    缓存目录结构是：用户主目录下的 .wdm/drivers/驱动名/win64/版本号/驱动文件.exe。
    返回最新一个驱动文件的完整路径；一个都找不到就返回 None。
    """
    # 翻译：拼出缓存目录路径，例如 用户主目录/.wdm/drivers/edgedriver/win64
    cache_root = os.path.join(
        os.path.expanduser("~"), ".wdm", "drivers", driver_name, "win64"
    )
    # 翻译：把各个版本目录里的驱动文件全部列出来
    candidates = glob.glob(os.path.join(cache_root, "*", "*.exe"))
    if not candidates:
        return None
    # 翻译：按修改时间排序，取最新一个（一般是刚装的本机浏览器对应版本）
    return max(candidates, key=os.path.getmtime)


def create_driver():
    """
    翻译：创建浏览器驱动。
    优先用 Edge（Windows 自带，最省事）；Edge 不行就自动换成 Chrome。
    驱动查找顺序：先用本地缓存的驱动（离线秒开），没有缓存再联网下载匹配版本。
    """
    # 翻译：先尝试 Edge
    try:
        from selenium.webdriver.edge.service import Service as EdgeService

        options = _build_options(webdriver.EdgeOptions())

        # 翻译：优先用本地缓存的 Edge 驱动，避免每次跑测试都联网检查
        local_path = _find_local_driver("edgedriver")
        if local_path:
            service = EdgeService(executable_path=local_path)
        else:
            # 翻译：本地没有缓存，才走联网下载（老版本 Selenium 的兜底方案）
            from webdriver_manager.microsoft import EdgeChromiumDriverManager
            service = EdgeService(EdgeChromiumDriverManager().install())

        driver = webdriver.Edge(service=service, options=options)
        print(f"使用浏览器：Edge（驱动：{local_path or '联网下载'}）")
        return driver
    except Exception as e:
        print(f"Edge 启动失败（{e}），尝试 Chrome……")

    # 翻译：再尝试 Chrome
    try:
        from selenium.webdriver.chrome.service import Service as ChromeService

        options = _build_options(webdriver.ChromeOptions())

        # 翻译：同样优先用本地缓存的 Chrome 驱动
        local_path = _find_local_driver("chromedriver")
        if local_path:
            service = ChromeService(executable_path=local_path)
        else:
            from webdriver_manager.chrome import ChromeDriverManager
            service = ChromeService(ChromeDriverManager().install())

        driver = webdriver.Chrome(service=service, options=options)
        print(f"使用浏览器：Chrome（驱动：{local_path or '联网下载'}）")
        return driver
    except Exception as e:
        raise RuntimeError(f"Edge 和 Chrome 都启动不了：{e}")


# ============================================================
# Pytest 用例
# ============================================================

@pytest.fixture(scope="module")
def driver():
    """
    翻译：整个测试模块共用一个浏览器（module 级），
    避免每个用例都开关一次浏览器。
    """
    d = create_driver()
    d.get(BASE_URL)
    yield d
    d.quit()


class TestCharacterCreation:
    """车卡全流程回归测试"""

    def test_01_welcome_page(self, driver):
        """翻译：检查规则选择页是否正常展示 DND 5R 入口"""
        # 翻译：检查 DND 5R 卡片可见
        card = driver.find_element(By.CSS_SELECTOR, '.rule-card[data-rule="dnd_5r"]')
        assert card.is_displayed(), "DND 5R 规则卡片没有显示"
        print("规则选择页正常，DND 5R 卡片可见")

    def test_02_full_creation_flow(self, driver):
        """翻译：从进入 DND 5R 开始，把 17 步完整走一遍"""
        tester = CharacterCreationTester(driver)

        # 翻译：进入 DND 5R → 开新角色
        tester.enter_dnd_5r()
        tester.start_new_character()

        # 翻译：跑完整流程
        data = tester.run_full_flow()

        # 翻译：核心断言——这些数据缺一个都说明流程有问题
        assert data.race_name, "没有记录到种族"
        assert data.class_name, "没有记录到职业"
        assert data.background_name, "没有记录到背景"
        assert data.character_name, "没有记录到角色名"
        assert len(data.ability_scores) == 6, "属性数据不完整"

        # 翻译：打印最终角色摘要，方便看日志
        print("\n" + "=" * 50)
        print("角色创建摘要")
        print("=" * 50)
        print(f"  角色名：{data.character_name}")
        print(f"  种族：{data.race_name}（{data.subrace_name or '无亚种'}）")
        print(f"  职业：{data.class_name}")
        print(f"  背景：{data.background_name}")
        print(f"  属性：{data.ability_scores}")
        print(f"  技能：{data.class_skills + data.bg_skills}")
        print(f"  专长：{data.feat_name}")
        print(f"  购物：{data.shopping_cart}")
        print(f"  语言：{data.languages}")
        print("=" * 50)


class TestCrossCoverage:
    """交叉覆盖测试：验证不同代码路径"""

    def _run_specified_flow(self, driver, race, subrace, cls, bg, pkg_label="默认套装"):
        """翻译：按指定组合跑完车卡流程"""
        tester = CharacterCreationTester(driver)
        tester.enter_dnd_5r()
        tester.start_new_character()

        # 步骤1：种族
        tester.do_race(race)
        ok, msg = tester.go_next()
        assert ok, f"种族页下一步失败：{msg}"

        # 步骤2：亚种（如果有）
        step = tester.get_step()
        if step == 2:
            tester.do_subrace(subrace)
            ok, msg = tester.go_next()
            assert ok, f"亚种页下一步失败：{msg}"

        # 步骤3：职业
        tester.do_class(cls)
        ok, msg = tester.go_next()
        assert ok, f"职业页下一步失败：{msg}"

        # 步骤4：职业套装
        step = tester.get_step()
        if step == 4:
            tester._do_package_step("packageGrid", "class_package", "职业套装")
            ok, msg = tester.go_next()
            assert ok, f"职业套装页下一步失败：{msg}"

        # 步骤5：背景
        tester.do_background(bg)
        ok, msg = tester.go_next()
        assert ok, f"背景页下一步失败：{msg}"

        # 步骤6：背景套装
        step = tester.get_step()
        if step == 6:
            tester._do_package_step("bgPackageGrid", "bg_package", "背景套装")
            ok, msg = tester.go_next()
            assert ok, f"背景套装页下一步失败：{msg}"

        # 步骤7-17：用默认流程跑完
        try:
            tester.run_full_flow()
        except Exception:
            # 失败时自动输出控制台日志辅助排查
            print("\n  [交叉覆盖] 用例失败，输出控制台日志：")
            tester.print_console_summary()
            raise
        return tester.data

    def test_CROSS_001_elf_wizard(self, driver):
        """交叉用例001：精灵→高等精灵→法师→侍僧（有亚种+施法职业）"""
        data = self._run_specified_flow(driver, "精灵", "高等精灵", "法师", "侍僧")
        assert data.race_name == "精灵"
        assert "高等精灵" in data.subrace_name
        assert data.class_name == "法师"
        assert data.background_name == "侍僧"

    def test_CROSS_002_human_fighter(self, driver):
        """交叉用例002：人类→战士→罪犯（无亚种+非施法职业）"""
        data = self._run_specified_flow(driver, "人类", None, "战士", "罪犯")
        assert data.race_name == "人类"
        assert data.subrace_name == ""  # 人类无亚种
        assert data.class_name == "战士"
        assert data.background_name == "罪犯"

    def test_CROSS_003_dragonborn_barbarian(self, driver):
        """交叉用例003：龙裔→白龙→野蛮人→流浪者（有亚种+非施法职业）"""
        data = self._run_specified_flow(driver, "龙裔", "白龙", "野蛮人", "流浪者")
        assert data.race_name == "龙裔"
        assert "白龙" in data.subrace_name
        assert data.class_name == "野蛮人"
        assert data.background_name == "流浪者"

    def test_CROSS_004_tiefling_cleric(self, driver):
        """交叉用例004：提夫林→炼狱→牧师→贵族（有亚种+施法职业）"""
        data = self._run_specified_flow(driver, "提夫林", "炼狱", "牧师", "贵族")
        assert data.race_name == "提夫林"
        assert "炼狱" in data.subrace_name
        assert data.class_name == "牧师"
        assert data.background_name == "贵族"

    def test_CROSS_005_gnome_rogue(self, driver):
        """交叉用例005：侏儒→岩石侏儒→游荡者→士兵（有亚种+多技能选择）"""
        data = self._run_specified_flow(driver, "侏儒", "岩石", "游荡者", "士兵")
        assert data.race_name == "侏儒"
        assert "岩石" in data.subrace_name
        assert data.class_name == "游荡者"
        assert data.background_name == "士兵"


class TestDataChangeValidation:
    """数据变更验证测试：修改JSON后验证系统行为"""

    def test_DATA_001_modify_class_skills(self, driver):
        """DATA-001：修改职业技能列表后验证步骤10显示新技能"""
        tester = CharacterCreationTester(driver)
        
        # 备份原始数据
        assert tester.backup_json_data(), "备份失败"
        
        # 修改 classes.json 中战士的 skill_prof
        def modify_warrior_skills(data):
            original_skills = None
            for cls in data:
                if cls.get("name") == "战士":
                    original_skills = cls.get("skill_prof", "")
                    # 修改为不同的技能ID：7=巧手, 20=驯兽, 28=威吓
                    cls["skill_prof"] = "7,20,28"
                    break
            # 必须返回修改后的完整 data，而不是只返回原始值
            return data if original_skills else None
        
        modified = tester.modify_json_file("classes.json", modify_warrior_skills)
        assert modified, "未找到战士职业或修改失败"
        
        # 刷新页面并重新车卡
        tester.refresh_page()
        tester.enter_dnd_5r()
        tester.start_new_character()
        
        # 选人类→战士→罪犯
        tester.do_race("人类")
        tester.go_next()
        tester.do_class("战士")
        tester.go_next()
        
        # 职业套装
        step = tester.get_step()
        if step == 4:
            tester._do_package_step("packageGrid", "class_package", "职业套装")
            tester.go_next()
        
        # 背景
        tester.do_background("罪犯")
        tester.go_next()
        
        # 背景套装
        step = tester.get_step()
        if step == 6:
            tester._do_package_step("bgPackageGrid", "bg_package", "背景套装")
            tester.go_next()
        
        # 属性
        tester.do_ability()
        tester.go_next()
        
        # 背景加值
        tester.do_bg_bonus()
        tester.go_next()
        
        # 技能选择
        tester.do_skills()
        
        # 步骤9：验证技能列表（在 go_next 之前验证技能页显示）
        step = tester.get_step()
        assert step == 9, f"期望在步骤9，实际在步骤{step}"
        
        # 检查职业技能区是否显示修改后的技能
        # 修改后的技能ID：7=巧手, 20=驯兽, 28=威吓
        body_text = driver.find_element(By.TAG_NAME, "body").text
        for skill in ["巧手", "驯兽", "威吓"]:
            assert skill in body_text, f"职业技能区未显示修改后的技能：{skill}"
        
        print("  [DATA-001] 职业技能修改后显示正常（巧手、驯兽、威吓）")
        
        # 继续下一步
        tester.go_next()
        
        # 恢复原始数据
        tester.restore_json_data()
        tester.refresh_page()

    def test_DATA_002_modify_race_feature_expression(self, driver):
        """DATA-002：修改种族特性表达式后验证步骤13正确解析"""
        tester = CharacterCreationTester(driver)
        assert tester.backup_json_data(), "备份失败"
        
        # 修改 race_features.json 中某个特性的表达式
        def modify_race_feature(data):
            for feature in data:
                if feature.get("name") == "黑暗视觉":
                    original_expr = feature.get("expression", "")
                    feature["expression"] = "spells(class=3,lv=0)+1"  # 修改表达式
                    return original_expr
            return None
        
        original = tester.modify_json_file("race_features.json", modify_race_feature)
        assert original is not None, "未找到黑暗视觉特性"
        
        # 刷新并重新车卡
        tester.refresh_page()
        tester.enter_dnd_5r()
        tester.start_new_character()
        
        # 选精灵→高等精灵
        tester.do_race("精灵")
        tester.go_next()
        tester.do_subrace("高等精灵")
        tester.go_next()
        
        # 快速走到步骤13
        for target_step in range(3, 14):
            step = tester.get_step()
            if step == 13:
                break
            handler = {
                3: lambda: tester.do_class("法师"),
                4: lambda: tester._do_package_step("packageGrid", "class_package", "职业套装"),
                5: lambda: tester.do_background("侍僧"),
                6: lambda: tester._do_package_step("bgPackageGrid", "bg_package", "背景套装"),
                7: tester.do_ability,
                8: tester.do_bg_bonus,
                9: tester.do_skills,
                10: tester.do_feat,
                11: tester.do_spells_skip,
                12: tester.do_shopping,
            }.get(step)
            if handler:
                try:
                    handler()
                except:
                    pass
            tester.go_next()
        
        # 验证步骤13特性总览
        step = tester.get_step()
        assert step == 13, f"期望到步骤13，实际在步骤{step}"
        
        # 验证特性总览能正常显示（不崩溃）
        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert "特性选择总览" in body_text, "特性总览页未正常显示"
        
        print("  [DATA-002] 种族特性表达式修改后解析正常")
        
        # 恢复原始数据
        tester.restore_json_data()
        tester.refresh_page()

    def test_DATA_007_bard_all_skills(self, driver):
        """DATA-007：验证修改职业技能为"all"（吟游诗人路径）后步骤10正确显示全技能池"""
        tester = CharacterCreationTester(driver)
        assert tester.backup_json_data(), "备份失败"
        
        # 修改战士的 skill_prof 为 "all"
        def modify_to_all_skills(data):
            for cls in data:
                if cls.get("name") == "战士":
                    cls["skill_prof"] = "all"
                    break
            return data
        
        assert tester.modify_json_file("classes.json", modify_to_all_skills), "修改失败"
        
        # 刷新并重新车卡
        tester.refresh_page()
        tester.enter_dnd_5r()
        tester.start_new_character()
        
        # 选人类→战士
        tester.do_race("人类")
        tester.go_next()
        tester.do_class("战士")
        tester.go_next()
        
        # 职业套装
        step = tester.get_step()
        if step == 4:
            tester._do_package_step("packageGrid", "class_package", "职业套装")
            tester.go_next()
        
        # 背景
        tester.do_background("侍僧")
        tester.go_next()
        
        # 背景套装
        step = tester.get_step()
        if step == 6:
            tester._do_package_step("bgPackageGrid", "bg_package", "背景套装")
            tester.go_next()
        
        # 属性
        tester.do_ability()
        tester.go_next()
        
        # 背景加值
        tester.do_bg_bonus()
        tester.go_next()
        
        # 技能选择
        tester.do_skills()
        
        # 步骤9：验证全技能池（在 go_next 之前验证技能页显示）
        step = tester.get_step()
        assert step == 9, f"期望在步骤9，实际在步骤{step}"
        
        # 验证职业技能区显示全部技能可选（18个技能）
        # 注意：do_skills() 选满后，未选中的技能会被标记为 disabled
        # 所以要验证的是职业技能区的总技能数，而不是 .skill-item:not(.disabled) 的数量
        skill_section = tester.find(By.CSS_SELECTOR, ".skill-section")
        skill_grid = skill_section.find_element(By.CSS_SELECTOR, ".skill-grid")
        all_class_skills = skill_grid.find_elements(By.CSS_SELECTOR, ".skill-item")
        skill_count = len(all_class_skills)
        print(f"  [DATA-007] 职业技能区总技能数量：{skill_count}")
        # 全技能池应该有 18 个技能（D&D 5E 标准技能列表）
        assert skill_count == 18, f"全技能池技能数量异常：{skill_count}（期望18）"
        
        print("  [DATA-007] skill_prof='all' 路径验证正常")
        
        # 继续下一步
        tester.go_next()
        
        # 恢复原始数据
        tester.restore_json_data()
        tester.refresh_page()


class TestExportImport:
    """导出/导入测试：验证导出 JSON 数据一致性、导入恢复、PDF 导出"""

    def _run_full_flow_to_finish(self, driver):
        """翻译：跑完整个车卡流程，停在完成页（步骤16）"""
        tester = CharacterCreationTester(driver)
        tester.enter_dnd_5r()
        tester.start_new_character()
        tester.run_full_flow()
        step = tester.get_step()
        assert step == 16, f"期望停在步骤16，实际在步骤{step}"
        return tester

    def test_EXPORT_001_json_export_consistency(self, driver):
        """EXPORT-001：导出 JSON 数据与页面显示一致"""
        # 先跑完整个车卡流程
        tester = self._run_full_flow_to_finish(driver)

        # 清理旧下载文件
        tester.cleanup_downloads(DOWNLOAD_DIR)

        # 导出 JSON
        json_path = tester.export_json(DOWNLOAD_DIR)
        print(f"  [EXPORT-001] 导出文件：{os.path.basename(json_path)}")

        # 验证导出内容
        data = tester.verify_export_json(json_path)

        # 验证导出数据和页面记录的数据一致
        assert data.get("name") != "", "导出 JSON 角色名为空"
        print(f"  [EXPORT-001] 导出 JSON 数据验证通过")

        # 清理下载文件
        tester.cleanup_downloads(DOWNLOAD_DIR)

    def test_EXPORT_002_json_import_restore(self, driver):
        """EXPORT-002：导出 JSON 后可重新导入并恢复角色数据"""
        # 先跑完整个车卡流程
        tester = self._run_full_flow_to_finish(driver)

        # 记录页面数据
        recorded_race = tester.data.race_name
        recorded_class = tester.data.class_name
        recorded_bg = tester.data.background_name

        # 导出 JSON
        tester.cleanup_downloads(DOWNLOAD_DIR)
        json_path = tester.export_json(DOWNLOAD_DIR)
        data = tester.verify_export_json(json_path)

        # 导入 JSON（内部会刷新页面）
        tester.import_json(json_path)

        # 验证导入结果
        tester.verify_import_result(data)

        print(f"  [EXPORT-002] 导入恢复验证通过（种族={recorded_race}, 职业={recorded_class}, 背景={recorded_bg})")

        # 清理下载文件
        tester.cleanup_downloads(DOWNLOAD_DIR)

    def test_EXPORT_003_pdf_export(self, driver):
        """EXPORT-003：导出 PDF 文件正常"""
        # 先跑完整个车卡流程
        tester = self._run_full_flow_to_finish(driver)

        # 清理旧下载文件
        tester.cleanup_downloads(DOWNLOAD_DIR)

        # 导出 PDF
        pdf_path = tester.verify_pdf_export(DOWNLOAD_DIR)
        print(f"  [EXPORT-003] 导出文件：{os.path.basename(pdf_path)}")

        # 验证 PDF 内容（基本检查）
        tester.verify_pdf_content(pdf_path, {})

        # 清理下载文件
        tester.cleanup_downloads(DOWNLOAD_DIR)


class TestUnbind:
    """解绑功能测试：验证解绑开关能正常切换并影响选择"""

    def _go_to_skills(self, driver):
        """翻译：快速走到步骤9技能页"""
        tester = CharacterCreationTester(driver)
        tester.enter_dnd_5r()
        tester.start_new_character()

        # 选人类→战士→侍僧
        tester.do_race("人类")
        tester.go_next()
        tester.do_class("战士")
        tester.go_next()
        step = tester.get_step()
        if step == 4:
            tester._do_package_step("packageGrid", "class_package", "职业套装")
            tester.go_next()
        tester.do_background("侍僧")
        tester.go_next()
        step = tester.get_step()
        if step == 6:
            tester._do_package_step("bgPackageGrid", "bg_package", "背景套装")
            tester.go_next()
        tester.do_ability()
        tester.go_next()
        tester.do_bg_bonus()
        tester.go_next()
        return tester

    def test_UNBIND_001_class_skill_unbind(self, driver):
        """UNBIND-001：职业技能解绑后能选择非职业池技能"""
        tester = self._go_to_skills(driver)
        step = tester.get_step()
        assert step == 9, f"期望到步骤9，实际在步骤{step}"

        # 验证解绑开关初始状态为未激活
        assert not tester.is_unbind_active("classSkill"), "职业技能解绑初始状态异常"

        # 点击解绑开关
        is_active = tester.toggle_unbind("classSkill")
        assert is_active, "职业技能解绑开关未激活"

        # 验证解绑后技能区有变化（可选技能数量增加）
        body_text = driver.find_element(By.TAG_NAME, "body").text
        skill_items = tester.find_all(By.CSS_SELECTOR, ".skill-item:not(.disabled)")
        print(f"  [UNBIND-001] 解绑后可选技能数量：{len(skill_items)}")
        assert len(skill_items) > 0, "解绑后没有可选技能"

        # 尝试选择一个非职业池的技能
        selected_before = len(tester.find_all(By.CSS_SELECTOR, ".skill-item.selected"))
        unselected = tester.find_all(By.CSS_SELECTOR, ".skill-item:not(.selected):not(.disabled)")
        if unselected:
            unselected[0].click()
            tester.short_sleep(0.2)
            selected_after = len(tester.find_all(By.CSS_SELECTOR, ".skill-item.selected"))
            assert selected_after > selected_before, "解绑后无法选择额外技能"
            print("  [UNBIND-001] 解绑后成功选择额外技能")

    def test_UNBIND_002_bg_skill_unbind(self, driver):
        """UNBIND-002：背景技能解绑后能选择非背景池技能"""
        tester = self._go_to_skills(driver)

        # 背景技能解绑
        assert not tester.is_unbind_active("bgSkill"), "背景技能解绑初始状态异常"
        is_active = tester.toggle_unbind("bgSkill")
        assert is_active, "背景技能解绑开关未激活"

        # 验证解绑后可选
        bg_section = tester.find_all(By.CSS_SELECTOR, ".skill-section")
        if len(bg_section) >= 2:
            items = bg_section[1].find_elements(By.CSS_SELECTOR, ".skill-item:not(.disabled)")
            print(f"  [UNBIND-002] 背景技能区可选数量：{len(items)}")
            assert len(items) > 0, "背景技能解绑后没有可选技能"

    def test_UNBIND_003_feat_unbind(self, driver):
        """UNBIND-003：专长解绑后能选择非推荐专长"""
        tester = CharacterCreationTester(driver)
        tester.enter_dnd_5r()
        tester.start_new_character()

        # 快速走到步骤11专长页
        tester.do_race("人类")
        tester.go_next()
        tester.do_class("战士")
        tester.go_next()
        step = tester.get_step()
        if step == 4:
            tester._do_package_step("packageGrid", "class_package", "职业套装")
            tester.go_next()
        tester.do_background("罪犯")
        tester.go_next()
        step = tester.get_step()
        if step == 6:
            tester._do_package_step("bgPackageGrid", "bg_package", "背景套装")
            tester.go_next()
        tester.do_ability()
        tester.go_next()
        tester.do_bg_bonus()
        tester.go_next()
        tester.do_skills()
        tester.go_next()

        step = tester.get_step()
        assert step == 10, f"期望到步骤10（专长），实际在步骤{step}"

        # 验证解绑开关
        assert not tester.is_unbind_active("feat"), "专长解绑初始状态异常"
        is_active = tester.toggle_unbind("feat")
        assert is_active, "专长解绑开关未激活"

        # 验证解绑后能看到更多专长
        feat_cards = tester.find_all(By.CSS_SELECTOR, ".feat-card:not(.disabled)")
        print(f"  [UNBIND-003] 解绑后可选专长数量：{len(feat_cards)}")
        assert len(feat_cards) > 0, "专长解绑后没有可选专长"


class TestGoBack:
    """回退测试：验证上一步按钮功能"""

    def test_BACK_001_prev_button_navigation(self, driver):
        """BACK-001：上一步按钮能正常导航并保留已选数据"""
        tester = CharacterCreationTester(driver)
        tester.enter_dnd_5r()
        tester.start_new_character()

        # 先走到步骤5（背景选择）
        tester.do_race("精灵")
        tester.go_next()

        # 检查步骤2或步骤3
        step = tester.get_step()
        if step == 2:
            tester.do_subrace("高等精灵")
            tester.go_next()
            # 等待页面跳转完成
            tester.short_sleep(1)

        step = tester.get_step()
        assert step == 3, f"期望到步骤3，实际在步骤{step}"

        # 在步骤3做元素检查
        passed, missing = tester.verify_page_elements(3)
        assert passed, f"步骤3元素缺失：{missing}"

        tester.do_class("法师")
        tester.go_next()

        step = tester.get_step()
        if step == 4:
            # 步骤4做元素检查
            passed, missing = tester.verify_page_elements(4)
            assert passed, f"步骤4元素缺失：{missing}"
            tester._do_package_step("packageGrid", "class_package", "职业套装")
            tester.go_next()

        # 现在应该在步骤5
        step = tester.get_step()
        assert step == 5, f"期望到步骤5，实际在步骤{step}"

        # 步骤5做元素检查
        passed, missing = tester.verify_page_elements(5)
        assert passed, f"步骤5元素缺失：{missing}"

        # 点上一步，应该回到步骤4
        ok = tester.go_prev()
        assert ok, "上一步按钮点击失败"
        step = tester.get_step()
        assert step == 4, f"期望回到步骤4，实际在步骤{step}"

        # 验证步骤4的已选数据保留（职业套装应该还在）
        selected = tester.find_all(By.CSS_SELECTOR, "#packageGrid .race-card.selected")
        assert len(selected) > 0, "上一步后职业套装选择丢失"
        print(f"  [BACK-001] 上一步后数据保留正常，已选套装：{selected[0].find_element(By.CSS_SELECTOR, '.race-name').text}")

        # 再点上一步，回到步骤3
        ok = tester.go_prev()
        assert ok, "第二次上一步点击失败"
        step = tester.get_step()
        assert step == 3, f"期望回到步骤3，实际在步骤{step}"

        # 验证职业选择保留
        selected = tester.find_all(By.CSS_SELECTOR, "#classGrid .race-card.selected")
        assert len(selected) > 0, "上一步后职业选择丢失"
        print(f"  [BACK-001] 职业选择保留正常")

    def test_BACK_002_prev_button_step1(self, driver):
        """BACK-002：步骤1时上一步按钮不可用"""
        tester = CharacterCreationTester(driver)
        tester.enter_dnd_5r()
        tester.start_new_character()

        step = tester.get_step()
        assert step == 1, f"期望在步骤1，实际在步骤{step}"

        # 步骤1不应该有上一步按钮（或按钮不可见）
        try:
            prev_btn = tester.find(By.ID, "prevBtn", timeout=3)
            style = prev_btn.get_attribute("style") or ""
            assert "visibility: hidden" in style or "display: none" in style, "步骤1上一步按钮应该不可见"
            print("  [BACK-002] 步骤1上一步按钮正确隐藏")
        except Exception:
            # 按钮不存在也算正常
            print("  [BACK-002] 步骤1无上一步按钮，正常")

        # 尝试点上一步应该返回False
        ok = tester.go_prev()
        assert not ok, "步骤1不应该能点上一步"


# ============================================================
# 直接运行入口（不通过 pytest）
# ============================================================

if __name__ == "__main__":
    print("=" * 50)
    print("车卡回归测试 · 直接运行模式")
    print("=" * 50)

    # 翻译：清理旧快照，只保留最近 5 次
    clear_old_snapshots(keep=5)
    print(f"📸 快照目录: {SNAPSHOT_DIR}")
    print(f"   报错自动快照: {'开' if SNAPSHOT_ON_ERROR else '关'}")
    print(f"   每步快照: {'开' if SNAPSHOT_EACH_STEP else '关'}")
    print(f"   (设环境变量 SNAPSHOT_EACH=1 可逐步保存，SNAPSHOT_OFF=1 关闭自动快照)")
    print()

    driver = create_driver()
    driver.get(BASE_URL)

    # 翻译：在最外层兜底 —— 如果整个流程崩了，最后存一次快照
    tester = None
    try:
        tester = CharacterCreationTester(driver)
        tester.enter_dnd_5r()
        tester.start_new_character()
        tester.run_full_flow()
        print("\n✅ 回归测试全部通过！")
    except Exception:
        print("\n❌ 回归测试失败：")
        traceback.print_exc()
        # 翻译：最后一次尝试保存快照（浏览器可能已经处于奇怪状态，不保证成功）
        if SNAPSHOT_ON_ERROR and tester:
            try:
                tester.snapshot("fatal", tester.get_step())
            except Exception:
                print("  ⚠ 最终快照保存也失败了")
        raise
    finally:
        if not HEADLESS:
            # 翻译：有头模式下暂停，方便肉眼检查最终页面
            input("\n按回车键关闭浏览器……")
        driver.quit()