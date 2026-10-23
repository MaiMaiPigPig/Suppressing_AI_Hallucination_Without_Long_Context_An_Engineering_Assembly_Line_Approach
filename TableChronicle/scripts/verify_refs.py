# -*- coding: utf-8 -*-
"""车卡工程 ESM 交叉引用校验脚本

验证内容：
1. 每个文件里 import 的目标文件是否存在；
2. import 的符号，在目标文件 export 出的集合中是否存在；
3. 汇报 steps/ 下存在但未被任何文件 import 的残留文件（提示死文件）。

范围：character/dnd_5r 下 creation/ handlers/ core/ code-handlers/ utils/
排除：upgrade/（v0.9 范围，属预期遗留）
"""
import io, os, re, sys

ROOT = r"F:\跑团工具\TableChronicle\character\dnd_5r"
SKIP_DIRS = {"upgrade", "__pycache__", "styles", "static"}

# import 语句：可匹配 named/default/namespace + from
IMPORT_RE = re.compile(
    r"import\s+"
    r"(?:\{([^}]*)\}|\*+?\s+as\s+\w+|\w+)?\s*"
    r"(?:,\s*\{([^}]*)\})?\s*"
    r"from\s+['\"]([^'\"]+)['\"]",
    re.S,
)
# export function/const/let/class/var
EXPORT_DECL_RE = re.compile(
    r"\bexport\s+(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)", re.S
)
# export { a, b as c }
EXPORT_LIST_RE = re.compile(r"export\s*\{([^}]*)\}")
# export { ... } from 'path'  （re-export，符号来自目标文件）
REEXPORT_RE = re.compile(
    r"export\s*\{([^}]*)\}\s*from\s*['\"]([^'\"]+)['\"]", re.S
)
IMPORT_NAMES_RE = re.compile(r"([A-Za-z_$][\w$]*)")


def read(path):
    with io.open(path, "r", encoding="utf-8") as f:
        return f.read()


def rel_target(base_dir, mod):
    if not (mod.startswith("./") or mod.startswith("../")):
        return None  # 非相对导入（node 内置等）跳过
    return os.path.normpath(os.path.join(base_dir, mod)) + (".js" if not mod.endswith(".js") else "")


def collect_files(root):
    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn.endswith(".js"):
                files.append(os.path.join(dirpath, fn))
    return files


def collect_exports(content):
    """返回该文件所有可被 import 的导出符号集合（含 re-export 的符号名，不追踪源）。"""
    names = set()
    names.update(EXPORT_DECL_RE.findall(content))
    for m in EXPORT_LIST_RE.finditer(content):
        # 排除 re-export 形式（export {..} from）单独匹配，这里只取无 from 的
        names.update(n.strip() for n in IMPORT_NAMES_RE.findall(m.group(1)))
    for rm in REEXPORT_RE.finditer(content):
        names.update(n.strip() for n in IMPORT_NAMES_RE.findall(rm.group(1)))
    return names


def main():
    files = collect_files(ROOT)
    export_map = {f: collect_exports(read(f)) for f in files}
    path_set = set(files)

    errors = []
    imported_counts = {}
    for f in files:  # 记录每个文件被 import 的次数
        imported_counts[f] = 0

    for f in files:
        content = read(f)
        base = os.path.dirname(f)
        for m in IMPORT_RE.finditer(content):
            named, named2, mod = m.group(1), m.group(2), m.group(3)
            target = rel_target(base, mod)
            if target is None:
                continue
            if target not in path_set:
                errors.append(f"[缺失文件] {os.path.relpath(f, ROOT)} -> import '{mod}' (目标不存在: {os.path.relpath(target, ROOT)})")
                continue
            imported_counts[target] += 1
            # 校验符号
            syms = []
            if named:
                syms.extend(IMPORT_NAMES_RE.findall(named))
            if named2:
                syms.extend(IMPORT_NAMES_RE.findall(named2))
            if not syms:
                continue  # import 'x.js' 纯副作用
            exps = export_map[target]
            for s in set(syms):
                if s not in exps:
                    errors.append(
                        f"[符号缺失] {os.path.relpath(f, ROOT)} 引入 '{s}'，但 {os.path.relpath(target, ROOT)} 未导出该符号"
                    )

    # 未引用的 steps 文件（死文件提示）
    steps_dir = os.path.join(ROOT, "creation", "steps")
    for f in files:
        if os.path.dirname(f) == steps_dir and not f.endswith("dlc.js") and imported_counts[f] == 0:
            errors.append(f"[未引用] {os.path.relpath(f, ROOT)} 未被任何文件 import（疑似残留死文件）")

    if not errors:
        print("✓ 校验通过：所有 import 目标存在，符号匹配，无残留死文件")
        return 0

    print(f"✗ 发现 {len(errors)} 个问题：")
    seen = set()
    for e in errors:
        if e not in seen:
            seen.add(e)
            print("  " + e)
    return 1


if __name__ == "__main__":
    sys.exit(main())