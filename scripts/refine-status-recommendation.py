from pathlib import Path

path = Path("app/inspection-app.tsx")
text = path.read_text()

old = '''  if (
    combined.includes("已完成處理") ||
    combined.includes("已結案") ||
    combined.includes("無，案件可結案")
  ) {
    return "已結案";
  }'''
new = '''  if (
    combined.includes("已結案") ||
    combined.includes("無，案件可結案") ||
    (result.trim().startsWith("已完成") && !nextStep.trim())
  ) {
    return "已結案";
  }'''
if text.count(old) != 1:
    raise RuntimeError(f"recommendation block match count: {text.count(old)}")
text = text.replace(old, new, 1)

old_placeholder = 'placeholder="搜尋水號、姓名、地址、表號"'
new_placeholder = 'placeholder="搜尋水號、姓名、地址、進度或處理內容"'
if text.count(old_placeholder) != 1:
    raise RuntimeError(f"placeholder match count: {text.count(old_placeholder)}")
text = text.replace(old_placeholder, new_placeholder, 1)

path.write_text(text)
print("Refined close recommendation and search hint.")
