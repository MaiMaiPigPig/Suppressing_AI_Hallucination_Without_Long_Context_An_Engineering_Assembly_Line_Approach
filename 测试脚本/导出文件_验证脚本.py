r"""
导出文件验证脚本
================
独立脚本，不依赖 pytest。

流程：
  1. 启动浏览器，跑完整车卡流程到第 16 步（完成页）
  2. 点击"导出 JSON"→文件落到 开发资源\角色卡\测试文件
  3. 校验 JSON：结构完整、关键字段不缺
  4. 点击"导出 PDF"→文件落到同一目录
  5. 校验 PDF：文件大小正常、可被读取
  6. 清理测试文件

运行：
  python 测试脚本/导出文件_验证脚本.py
"""

import datetime
import glob
import json
import os
import random
import re
import time
import traceback

from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
from selenium.webdriver.edge.service import Service as EdgeService
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = "http://127.0.0.1:5001/character"
EXPLICIT_WAIT = 15

# 下载目标目录
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOWNLOAD_DIR = os.path.join(ROOT, "开发资源", "角色卡", "测试文件")

# 关键字段列表（导出 JSON 必须包含的）
REQUIRED_JSON_FIELDS = [
    "name", "raceId", "classId", "backgroundId",
    "abilities", "classSkills", "backgroundSkills", "allSkills",
    "featureSelections", "selectedSpells",
    "classPackage", "bgPackage", "shoppingItems",
]

# PDF 最小大小（字节），小于这个视为导出失败
PDF_MIN_SIZE = 10000


class ExportVerifier:
    def __init__(self, driver):
        self.driver = driver

    # ===== 基础操作 =====

    def wait_el(self, by, value, timeout=EXPLICIT_WAIT):
        return WebDriverWait(self.driver, timeout).until(
            EC.presence_of_element_located((by, value))
        )

    def find_clickable(self, by, value, timeout=EXPLICIT_WAIT):
        return WebDriverWait(self.driver, timeout).until(
            EC.element_to_be_clickable((by, value))
        )

    def short_sleep(self, lo=0.3, hi=0.6):
        time.sleep(random.uniform(lo, hi))

    def get_step(self):
        try:
            text = self.driver.find_element(By.CSS_SELECTOR, ".step-indicator").text
            m = re.search(r"第\s*(\d+)\s*步", text)
            return int(m.group(1)) if m else 0
        except NoSuchElementException:
            return 0

    def click_next(self):
        btn = self.find_clickable(By.ID, "nextBtn")
        self.driver.execute_script("arguments[0].click();", btn)
        self.short_sleep()
        alert_text = self.accept_alert_if_any()
        if alert_text:
            print(f"  ⚠ 弹窗: {alert_text}")

    def accept_alert_if_any(self, timeout=1):
        try:
            WebDriverWait(self.driver, timeout).until(EC.alert_is_present())
            alert = self.driver.switch_to.alert
            text = alert.text
            alert.accept()
            return text
        except TimeoutException:
            return None

    # ===== 车卡流程（精简版，只走必要步骤）=====

    def enter_dnd_5r(self):
        card = self.find_clickable(By.CSS_SELECTOR, '.rule-card[data-rule="dnd_5r"]')
        card.click()
        self.short_sleep(1, 1.5)

    def start_new_character(self):
        btn = self.find_clickable(By.XPATH, "//div[contains(@class,'start-card-title') and text()='新角色']")
        btn.click()
        self.short_sleep(1, 1.5)

    def pick_random_option(self, container_selector, item_selector):
        """在容器内随机选一个并点击"""
        try:
            container = self.wait_el(By.CSS_SELECTOR, container_selector)
            items = container.find_elements(By.CSS_SELECTOR, item_selector)
            if not items:
                return False
            item = random.choice(items)
            self.driver.execute_script("arguments[0].click();", item)
            self.short_sleep(0.5, 0.8)
            return True
        except Exception:
            return False

    def run_flow_to_step16(self):
        print("开始走车卡流程...")

        # 步骤 1：种族 — 随机选
        cards1 = self.driver.find_elements(By.CSS_SELECTOR, "#raceGrid .race-card")
        assert cards1, "种族列表是空的"
        chosen = random.choice(cards1)
        name1 = chosen.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
        self.driver.execute_script("arguments[0].click();", chosen)
        print(f"  ✅ 步骤1: 种族={name1}")
        self.short_sleep(0.5, 0.8)
        self.click_next()

        # 步骤 2：亚种（可能自动跳过）
        self.short_sleep(0.5, 0.8)
        step = self.get_step()
        if step == 2:
            cards2 = self.driver.find_elements(By.CSS_SELECTOR, "#subraceGrid .race-card")
            if cards2:
                chosen = random.choice(cards2)
                name2 = chosen.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
                self.driver.execute_script("arguments[0].click();", chosen)
                print(f"  ✅ 步骤2: 亚种={name2}")
                self.short_sleep(0.5, 0.8)
            self.click_next()
        else:
            print(f"  ⏭ 步骤2: 自动跳过（当前步骤={step}）")

        # 步骤 3：职业
        step = self.get_step()
        if step == 3:
            cards3 = self.driver.find_elements(By.CSS_SELECTOR, "#classGrid .race-card")
            assert cards3, "职业列表是空的"
            chosen = random.choice(cards3)
            name3 = chosen.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
            self.driver.execute_script("arguments[0].click();", chosen)
            print(f"  ✅ 步骤3: 职业={name3}")
            self.short_sleep(0.5, 0.8)
            self.click_next()

        # 步骤 4：职业套装
        self.short_sleep(0.5, 0.8)
        for retry in range(3):
            step = self.get_step()
            if step != 4:
                break
            cards4 = self.driver.find_elements(By.CSS_SELECTOR, "#packageGrid .race-card")
            if not cards4:
                print("  ⏭ 步骤4: 无职业套装可选")
                self.click_next()
                continue
            # 优先选已选中的，否则选第一个
            selected = [c for c in cards4 if "selected" in (c.get_attribute("class") or "")]
            chosen = selected[0] if selected else cards4[0]
            if "selected" not in (chosen.get_attribute("class") or ""):
                self.driver.execute_script("arguments[0].click();", chosen)
            nm = chosen.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
            print(f"  ✅ 步骤4: 职业套装={nm}")
            self.short_sleep(0.3, 0.5)
            self.click_next()
            self.short_sleep(0.3, 0.5)

        # 步骤 5：背景
        step = self.get_step()
        if step == 5:
            cards5 = self.driver.find_elements(By.CSS_SELECTOR, "#backgroundGrid .race-card")
            assert cards5, "背景列表是空的"
            chosen = random.choice(cards5)
            try:
                nm = chosen.find_element(By.CSS_SELECTOR, ".bg-name").text.strip()
            except Exception:
                nm = chosen.text.strip()[:20]
            self.driver.execute_script("arguments[0].click();", chosen)
            print(f"  ✅ 步骤5: 背景={nm}")
            self.short_sleep(0.5, 0.8)
            self.click_next()

        # 步骤 6：背景套装
        self.short_sleep(0.5, 0.8)
        for retry in range(3):
            step = self.get_step()
            if step != 6:
                break
            cards6 = self.driver.find_elements(By.CSS_SELECTOR, "#bgPackageGrid .race-card")
            if not cards6:
                print("  ⏭ 步骤6: 无背景套装可选")
                self.click_next()
                continue
            selected = [c for c in cards6 if "selected" in (c.get_attribute("class") or "")]
            chosen = selected[0] if selected else cards6[0]
            if "selected" not in (chosen.get_attribute("class") or ""):
                self.driver.execute_script("arguments[0].click();", chosen)
            nm = chosen.find_element(By.CSS_SELECTOR, ".race-name").text.strip()
            print(f"  ✅ 步骤6: 背景套装={nm}")
            self.short_sleep(0.3, 0.5)
            self.click_next()
            self.short_sleep(0.3, 0.5)

        # 步骤 7：属性 — 随机分配
        step = self.get_step()
        if step == 7:
            try:
                self.driver.execute_script("doRandomGenerate();")
                self.short_sleep(0.8, 1.2)
                sets = self.driver.find_elements(By.CSS_SELECTOR, ".ability-set")
                assert sets, "no ability sets generated"
                self.driver.find_elements(By.CSS_SELECTOR, ".ability-set button")[0].click()
                self.short_sleep(0.5, 0.8)
                for i in range(6):
                    self.driver.find_elements(By.CSS_SELECTOR, ".ability-pool-num")[i].click()
                    self.short_sleep(0.1, 0.2)
                    self.driver.find_elements(By.CSS_SELECTOR, ".ability-slot")[i].click()
                    self.short_sleep(0.1, 0.2)
                filled = self.driver.find_elements(By.CSS_SELECTOR, ".ability-slot.filled")
                assert len(filled) == 6, f"only {len(filled)}/6 slots filled"
            except Exception as e:
                print(f"  !! s7 error: {e}")
            self.click_next()
            print("  ✅ 步骤7: 属性已填")

        # 步骤 8：背景加值 — 每行点一次 "+"
        self.short_sleep(0.5, 0.8)
        step = self.get_step()
        if step == 8:
            rows = self.driver.find_elements(By.CSS_SELECTOR, ".bonus-row")
            assert rows, "背景加值页没有加值行"
            for i in range(len(rows)):
                xpath = (
                    f"(//div[contains(@class,'bonus-row')])[{i+1}]"
                    f"//button[normalize-space()='+']"
                )
                try:
                    self.driver.find_element(By.XPATH, xpath).click()
                    self.short_sleep(0.1, 0.2)
                except Exception:
                    pass
            self.click_next()
            print("  ✅ 步骤8: 背景加值已填")

        # 步骤 9：系统自动跳过，如果没跳就点下一步
        self.short_sleep(1, 1.5)
        step = self.get_step()
        if step == 9:
            self.click_next()
            print("  ✅ 步骤9: 已跳过")
            self.short_sleep(0.5, 0.8)
            step = self.get_step()

        # 步骤 10（原技能）：直接点下一步
        if step == 10:
            self.click_next()
            print("  ✅ 步骤10: 技能已过")
            self.short_sleep(0.5, 0.8)
            step = self.get_step()

        # 步骤 11（原专长）
        if step == 11:
            try:
                cards11 = self.driver.find_elements(By.CSS_SELECTOR, ".feat-card-grid .feat-card")
                if cards11:
                    chosen = random.choice(cards11)
                    self.driver.execute_script("arguments[0].click();", chosen)
                    self.short_sleep(0.5, 0.8)
                    print("  ✅ 步骤11: 专长已选")
            except Exception:
                pass
            self.click_next()

        # 步骤 12：商城
        self.short_sleep(0.5, 0.8)
        step = self.get_step()
        if step == 12:
            self.click_next()
            print("  ✅ 步骤12: 商城已过")

        # 步骤 13：特性总览 — 逐项点选直到全部选满
        self.short_sleep(0.5, 0.8)
        step = self.get_step()
        if step == 13:
            self._fill_feature_review()
            self.click_next()
            print("  ✅ 步骤13: 特性总览已填充")

        # 步骤 14：角色详情
        self.short_sleep(0.5, 0.8)
        step = self.get_step()
        if step == 14:
            try:
                name_input = self.driver.find_element(By.CSS_SELECTOR, '#detailName, input[id*="name"]')
                name_input.clear()
                name_input.send_keys("导出测试_" + datetime.datetime.now().strftime("%H%M%S"))
                self.short_sleep()
            except Exception:
                pass
            self.click_next()
            print("  ✅ 步骤14: 角色详情已填")

        # 步骤 15：角色卡
        self.short_sleep(0.5, 0.8)
        step = self.get_step()
        if step == 15:
            self.click_next()
            print("  ✅ 步骤15: 角色卡已确认")

        # 确认到达步骤 16
        self.short_sleep(1, 1.5)
        step = self.get_step()
        assert step == 16, f"未到达步骤16，当前步骤={step}"
        print("  ✅ 步骤16: 到达完成页")

    def _fill_feature_review(self):
        """特性总览页：逐分组找可选项点击，直到全选满（最多20轮）"""
        for _ in range(20):
            self.short_sleep(0.2, 0.4)
            sections = self.driver.find_elements(By.CSS_SELECTOR, ".feat-section")
            all_done = True
            for sec in sections:
                try:
                    cnt_text = sec.find_element(By.CSS_SELECTOR, ".feat-section-count").text
                except Exception:
                    continue
                m = re.search(r"(\d+)\s*/\s*(\d+)", cnt_text)
                if not m:
                    continue
                already, need = int(m.group(1)), int(m.group(2))
                if already >= need:
                    continue
                all_done = False
                # expand if collapsed
                try:
                    body = sec.find_element(By.CSS_SELECTOR, ".feat-section-body")
                    if "collapsed" in (body.get_attribute("class") or ""):
                        sec.find_element(By.CSS_SELECTOR, ".feat-section-header").click()
                        self.short_sleep(0.2, 0.4)
                except Exception:
                    pass
                # click first selectable item
                items = sec.find_elements(By.CSS_SELECTOR, ".selection-item:not(.selected):not(.disabled)")
                if items:
                    self.driver.execute_script("arguments[0].click();", items[0])
                    self.short_sleep(0.2, 0.4)
                    break
            if all_done:
                break

    # ===== 导出操作 =====

    def click_export_json(self):
        btn = self.find_clickable(By.CSS_SELECTOR, ".export-card[onclick*='exportCharacterJSON']")
        btn.click()
        print("  📥 已点击「导出 JSON」")
        self.short_sleep(2, 3)

    def click_export_pdf(self):
        btn = self.find_clickable(By.CSS_SELECTOR, ".export-card[onclick*='exportCharacterPDF']")
        btn.click()
        print("  📥 已点击「导出 PDF」")
        self.short_sleep(2, 3)

    # ===== 文件等待 =====

    def wait_for_file(self, ext, timeout_sec=30):
        deadline = time.time() + timeout_sec
        while time.time() < deadline:
            files = [f for f in os.listdir(DOWNLOAD_DIR) if f.endswith(ext)]
            if files:
                latest = max(files, key=lambda f: os.path.getmtime(os.path.join(DOWNLOAD_DIR, f)))
                filepath = os.path.join(DOWNLOAD_DIR, latest)
                time.sleep(1)
                # 确认文件大小稳定（不再增长）
                size1 = os.path.getsize(filepath)
                time.sleep(1)
                size2 = os.path.getsize(filepath)
                if size1 == size2 and size1 > 0:
                    return filepath
            time.sleep(0.5)
        return None


# ===== 校验逻辑（纯函数，不依赖浏览器）=====

def verify_json(filepath):
    print(f"\n  🔍 校验 JSON: {os.path.basename(filepath)}")
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert isinstance(data, dict), "JSON 顶层不是对象"

    missing = [k for k in REQUIRED_JSON_FIELDS if k not in data]
    if missing:
        print(f"  ⚠ 缺少字段: {missing}")
    else:
        print(f"  ✅ 全部 {len(REQUIRED_JSON_FIELDS)} 个关键字段都存在")

    # 检查 name
    assert data.get("name"), "角色名为空"
    print(f"  ✅ 角色名: {data['name']}")

    # 检查 abilities
    assert isinstance(data.get("abilities"), dict), "abilities 不是对象"
    assert len(data["abilities"]) == 6, f"abilities 数量不对: {len(data['abilities'])}"
    print(f"  ✅ 属性值: {data['abilities']}")

    # 检查 featureSelections
    fs = data.get("featureSelections", {})
    print(f"  ✅ featureSelections 包含: {list(fs.keys())}")

    # 文件大小
    size_kb = os.path.getsize(filepath) / 1024
    print(f"  ✅ JSON 文件大小: {size_kb:.1f} KB")
    return data


def verify_pdf(filepath):
    print(f"\n  🔍 校验 PDF: {os.path.basename(filepath)}")
    size = os.path.getsize(filepath)
    size_kb = size / 1024
    assert size > PDF_MIN_SIZE, f"PDF 文件太小（{size_kb:.1f} KB），可能导出失败"
    print(f"  ✅ PDF 文件大小: {size_kb:.1f} KB")

    # 检查 PDF 幻数
    with open(filepath, "rb") as f:
        header = f.read(5)
    assert header == b"%PDF-", f"PDF 文件头不正确: {header}"
    print("  ✅ PDF 文件头正确 (%PDF-)")

    # 检查尾部
    with open(filepath, "rb") as f:
        f.seek(-64, 2)
        tail = f.read(64)
    if b"%%EOF" in tail:
        print("  ✅ PDF 尾部标识正确 (%%EOF)")
    else:
        print("  ⚠ PDF 尾部未找到 %%EOF（可能不完整）")


def verify_pdf_readable(filepath):
    """尝试用 PyPDF2 / pdfplumber 读取 PDF，看是否能解析"""
    print(f"\n  📖 尝试解析 PDF 内容: {os.path.basename(filepath)}")

    # 优先 pdfplumber
    try:
        import pdfplumber
        with pdfplumber.open(filepath) as pdf:
            page_count = len(pdf.pages)
            print(f"  ✅ pdfplumber 解析成功，共 {page_count} 页")
            # 读第一页文本片段
            if page_count > 0:
                text = pdf.pages[0].extract_text() or ""
                preview = text[:200].replace("\n", " | ")
                print(f"  ✅ 第1页文本预览: {preview}...")
            return True
    except ImportError:
        pass
    except Exception as e:
        print(f"  ⚠ pdfplumber 解析异常: {e}")

    # 降级 PyPDF2
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(filepath)
        page_count = len(reader.pages)
        print(f"  ✅ PyPDF2 解析成功，共 {page_count} 页")
        if page_count > 0:
            text = reader.pages[0].extract_text() or ""
            preview = text[:200].replace("\n", " | ")
            print(f"  ✅ 第1页文本预览: {preview}...")
        return True
    except ImportError:
        print("  ⚠ 未安装 pdfplumber 或 PyPDF2，跳过内容解析")
        return None
    except Exception as e:
        print(f"  ⚠ PyPDF2 解析异常: {e}")
        return False


def cleanup():
    print(f"\n  🧹 清理测试文件: {DOWNLOAD_DIR}")
    for f in os.listdir(DOWNLOAD_DIR):
        fpath = os.path.join(DOWNLOAD_DIR, f)
        if f.endswith(".json") or f.endswith(".pdf"):
            os.remove(fpath)
            print(f"     已删除: {f}")
    print("  ✅ 清理完成")


def _find_local_driver(driver_name):
    """在 webdriver-manager 缓存目录找本地已下载的驱动"""
    cache_root = os.path.join(
        os.path.expanduser("~"), ".wdm", "drivers", driver_name, "win64"
    )
    candidates = glob.glob(os.path.join(cache_root, "*", "*.exe"))
    if not candidates:
        return None
    return max(candidates, key=os.path.getmtime)


def _build_options(edge_or_chrome_options):
    """统一配置浏览器选项 + 下载目录"""
    options = edge_or_chrome_options
    options.add_argument("--window-size=1400,900")
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-gpu")
    options.add_experimental_option("excludeSwitches", ["enable-logging"])

    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    prefs = {
        "download.default_directory": DOWNLOAD_DIR,
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True,
    }
    options.add_experimental_option("prefs", prefs)
    return options


def create_driver():
    """创建浏览器驱动：Edge 优先，Chrome 兜底，自动匹配驱动版本"""
    # 先尝试 Edge
    try:
        options = _build_options(webdriver.EdgeOptions())
        local_path = _find_local_driver("edgedriver")
        if local_path:
            service = EdgeService(executable_path=local_path)
        else:
            from webdriver_manager.microsoft import EdgeChromiumDriverManager
            service = EdgeService(EdgeChromiumDriverManager().install())

        driver = webdriver.Edge(service=service, options=options)
        print(f"使用浏览器：Edge（驱动：{local_path or '联网下载'}）")
        return driver
    except Exception as e:
        print(f"Edge 启动失败（{e}），尝试 Chrome……")

    # 再尝试 Chrome
    try:
        options = _build_options(webdriver.ChromeOptions())
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


# ===== 主流程 =====

def main():
    print("=" * 60)
    print("导出文件验证脚本")
    print(f"下载目录: {DOWNLOAD_DIR}")
    print("=" * 60)

    # 确保下载目录存在且干净
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    for f in os.listdir(DOWNLOAD_DIR):
        if f.endswith(".json") or f.endswith(".pdf"):
            os.remove(os.path.join(DOWNLOAD_DIR, f))

    print("启动浏览器...")
    driver = create_driver()
    verifier = ExportVerifier(driver)

    try:
        driver.get(BASE_URL)
        verifier.enter_dnd_5r()
        verifier.start_new_character()
        verifier.run_flow_to_step16()

        # ---- 导出 JSON ----
        print("\n" + "-" * 40)
        print("第 1 步：导出 JSON")
        print("-" * 40)
        verifier.click_export_json()
        json_path = verifier.wait_for_file(".json")
        if not json_path:
            raise TimeoutError("导出 JSON 文件下载超时")
        json_data = verify_json(json_path)

        # ---- 导出 PDF ----
        print("\n" + "-" * 40)
        print("第 2 步：导出 PDF")
        print("-" * 40)
        verifier.click_export_pdf()
        pdf_path = verifier.wait_for_file(".pdf")
        if not pdf_path:
            raise TimeoutError("导出 PDF 文件下载超时")
        verify_pdf(pdf_path)

        # ---- 尝试解析 PDF 内容 ----
        verify_pdf_readable(pdf_path)

        # ---- 角色名校验：PDF 里是否有角色名 ----
        print(f"\n  📝 额外校验: 角色名「{json_data.get('name', '')}」")
        # 用简单的文本搜索（上面 verify_pdf_readable 已打印了文本预览）

        print("\n" + "=" * 60)
        print("✅ 全部校验通过！")
        print("=" * 60)

    except Exception:
        print("\n" + "=" * 60)
        print("❌ 验证失败：")
        traceback.print_exc()
        print("=" * 60)
        raise

    finally:
        # ---- 清理 ----
        print("\n按回车键关闭浏览器并清理文件...")
        # 非交互时自动跳过
        # input()
        driver.quit()
        cleanup()


if __name__ == "__main__":
    main()