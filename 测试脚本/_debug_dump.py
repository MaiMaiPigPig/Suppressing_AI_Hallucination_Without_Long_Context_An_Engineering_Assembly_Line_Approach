# -*- coding: utf-8 -*-
# 翻译：临时诊断脚本，固定走「提夫林→深渊→邪术师→士兵」，到第14步后
#       把所有特性总览分组的计数文本和每个选项的 class 都打印出来，
#       用于搞清楚「魔能祈唤」分组为什么会“要选却无可选”。用完即删。
import importlib.util
import time

from selenium.webdriver.common.by import By

spec = importlib.util.spec_from_file_location(
    "t", r"f:\跑团工具\测试脚本\车卡_回归测试.py"
)
t = importlib.util.module_from_spec(spec)
spec.loader.exec_module(t)


def pick_card(driver, grid_id, keyword):
    # 翻译：在某个网格里找到名字包含关键字的卡，点击它
    cards = driver.find_elements(By.CSS_SELECTOR, f"#{grid_id} .race-card")
    for c in cards:
        name_el = c.find_element(By.CSS_SELECTOR, ".race-name")
        if keyword in name_el.text:
            driver.execute_script("arguments[0].click();", c)
            return name_el.text.strip()
    raise AssertionError(f"{grid_id} 里找不到 {keyword}")


def wait_sleep(sec=0.5):
    time.sleep(sec)


driver = t.create_driver()
tester = t.CharacterCreationTester(driver)

# 翻译：先打开车卡起始页（规则选择页），再进入 DND5R
driver.get(t.BASE_URL)
wait_sleep()

# 翻译：进入 DND5R 并开新角色
tester.enter_dnd_5r()
tester.start_new_character()

# 翻译：固定选提夫林 + 深渊（有亚种）
pick_card(driver, "raceGrid", "提夫林")
wait_sleep()
pick_card(driver, "subraceGrid", "深渊")
wait_sleep()

# 翻译：固定选邪术师职业
pick_card(driver, "classGrid", "邪术师")
wait_sleep()
tester._do_package_step("packageGrid", "class_package", "职业套装")
wait_sleep()

# 翻译：固定选士兵背景
pick_card(driver, "backgroundGrid", "士兵")
wait_sleep()
tester._do_package_step("bgPackageGrid", "bg_package", "背景套装")
wait_sleep()

# 翻译：属性随机 + 填满六槽
tester.do_ability()
wait_sleep()

# 翻译：背景加值每行 +1
tester.do_bg_bonus()
wait_sleep()

# 翻译：技能选满
tester.do_skills()
wait_sleep()

# 翻译：专长
tester.do_feat()
wait_sleep()

# 翻译：法术跳过
tester.do_spells_skip()
wait_sleep()

# 翻译：商城买一件
tester.do_shopping()
wait_sleep()

# 翻译：走到第14步（特性总览），直接 dump 所有分组的真实状态
dump_js = """
var out = [];
var secs = document.querySelectorAll('.feat-section');
for (var i = 0; i < secs.length; i++) {
    var s = secs[i];
    var cnt = s.querySelector('.feat-section-count');
    var cntText = cnt ? cnt.textContent.trim() : '(无计数字段)';
    var title = s.querySelector('.feat-section-title');
    var items = s.querySelectorAll('.selection-item');
    var itemInfo = [];
    for (var j = 0; j < items.length; j++) {
        var it = items[j];
        itemInfo.push({
            name: it.dataset.name,
            cls: it.className
        });
    }
    out.push({
        title: title ? title.textContent.trim() : '(无标题)',
        countText: cntText,
        itemCount: items.length,
        items: itemInfo
    });
}
return out;
"""

result = driver.execute_script(dump_js)
for sec in result:
    print("\n=== " + sec["title"] + " ===")
    print("  计数文本：" + sec["countText"])
    print("  选项数量：" + str(sec["itemCount"]))
    for it in sec["items"]:
        print(f"    - {it['name']}  |  class: {it['cls']}")

driver.quit()