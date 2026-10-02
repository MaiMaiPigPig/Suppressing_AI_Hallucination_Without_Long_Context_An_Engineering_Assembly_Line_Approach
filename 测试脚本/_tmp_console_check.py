# -*- coding: utf-8 -*-
"""临时：进入 DND5R 车卡，用 window.renderStep(7) 触发第 7 步渲染，捕获 console 错误"""
import os, io, sys, time
from selenium import webdriver
from selenium.webdriver.edge.options import Options
from selenium.webdriver.edge.service import Service as EdgeService
from selenium.webdriver.common.by import By
from webdriver_manager.microsoft import EdgeChromiumDriverManager

opts = Options()
opts.add_argument("--headless=new")
opts.add_argument("--window-size=1400,900")
service = EdgeService(EdgeChromiumDriverManager().install())
d = webdriver.Edge(service=service, options=opts)
d.set_window_size(1400, 900)

d.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {"source": """
window.__errs=[];
window.addEventListener('error', function(e){ window.__errs.push('ERR: '+e.message+' @ '+(e.filename||'')+':'+(e.lineno||'')); });
window.addEventListener('unhandledrejection', function(e){ window.__errs.push('REJ: '+(e.reason && e.reason.message ? e.reason.message : e.reason)); });
""".strip()})

d.get("http://127.0.0.1:5001/character/dnd_5r")
time.sleep(3)
try:
    d.find_element(By.CSS_SELECTOR, ".start-card-title").click()
    time.sleep(3)
    d.find_element(By.CSS_SELECTOR, ".step-indicator")
except Exception as e:
    print("进入 DND5R 失败:", e)

# 触发第 7 步渲染
d.execute_script("if (window.renderStep) { try { renderStep(7); } catch(e) { window.__errs.push('DIRECT: '+e.message); } } else { window.__errs.push('renderStep not on window'); }")
time.sleep(2)

con_logs = d.execute_script("return window.__errs")
body_txt = d.execute_script("return document.body ? document.body.innerText.slice(0,600) : '(no body)'")
print("===== console 错误 =====")
for l in (con_logs or []):
    print(l)
if not con_logs:
    print("(无错误)")
print("===== 第7步 body 文本 (前600) =====")
print(body_txt)
d.quit()