from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


path = Path("app/inspection-app.tsx")
text = path.read_text()
old_uploads = '''  async function uploadFiles(
    caseId: string,
    recordId: string | null,
    files: File[],
    category: string,
  ) {
    for (const file of files) {
      if (!file || file.size === 0) continue;
      const body = new FormData();
      body.set("caseId", caseId);
      if (recordId) body.set("recordId", recordId);
      body.set("category", category);
      body.set("file", file);
      await api("/api/uploads", { method: "POST", body });
    }
  }

  async function uploadCaseFormFiles(caseId: string, data: FormData) {
    await uploadFiles(caseId, null, data.getAll("system31") as File[], "system31");
    await uploadFiles(caseId, null, data.getAll("gis") as File[], "gis");
  }
'''
new_uploads = '''  async function uploadFiles(
    caseId: string,
    recordId: string | null,
    files: File[],
    category: string,
  ) {
    const failedFiles: string[] = [];
    for (const file of files) {
      if (!file || file.size === 0) continue;
      const body = new FormData();
      body.set("caseId", caseId);
      if (recordId) body.set("recordId", recordId);
      body.set("category", category);
      body.set("file", file);
      try {
        await api("/api/uploads", { method: "POST", body });
      } catch {
        failedFiles.push(file.name || "未命名附件");
      }
    }
    return failedFiles;
  }

  async function uploadCaseFormFiles(caseId: string, data: FormData) {
    const systemFailures = await uploadFiles(
      caseId,
      null,
      data.getAll("system31") as File[],
      "system31",
    );
    const gisFailures = await uploadFiles(
      caseId,
      null,
      data.getAll("gis") as File[],
      "gis",
    );
    return [...systemFailures, ...gisFailures];
  }

  function uploadWarning(savedLabel: string, failedFiles: string[]) {
    if (!failedFiles.length) return "";
    const names = failedFiles.slice(0, 5).join("、");
    const remainder = failedFiles.length > 5 ? `等 ${failedFiles.length} 個檔案` : "";
    return `${savedLabel}已儲存，但附件「${names}${remainder}」上傳失敗；可在案件內重新補傳，不需重複建立。`;
  }
'''
text = replace_once(text, old_uploads, new_uploads, "upload helpers")
old_create = '''      await uploadCaseFormFiles(result.case.id, data);
      await loadCases(result.case.id);
      setView("detail");'''
new_create = '''      const failedFiles = await uploadCaseFormFiles(result.case.id, data);
      await loadCases(result.case.id);
      setView("detail");
      const warning = uploadWarning("案件", failedFiles);
      if (warning) setError(warning);'''
text = replace_once(text, old_create, new_create, "create case upload handling")
old_save_case = '''      await uploadCaseFormFiles(selected.id, data);
      await loadCases(selected.id);
      setEditingCase(false);'''
new_save_case = '''      const failedFiles = await uploadCaseFormFiles(selected.id, data);
      await loadCases(selected.id);
      setEditingCase(false);
      const warning = uploadWarning("案件修改", failedFiles);
      if (warning) setError(warning);'''
text = replace_once(text, old_save_case, new_save_case, "save case upload handling")
old_add_record = '''      await uploadFiles(selected.id, result.record.id, data.getAll("media") as File[], "record");
      form.reset();
      setRecordFormVersion((version) => version + 1);
      await loadCases(selected.id);'''
new_add_record = '''      const failedFiles = await uploadFiles(
        selected.id,
        result.record.id,
        data.getAll("media") as File[],
        "record",
      );
      form.reset();
      setRecordFormVersion((version) => version + 1);
      await loadCases(selected.id);
      const warning = uploadWarning("處理紀錄", failedFiles);
      if (warning) setError(warning);'''
text = replace_once(text, old_add_record, new_add_record, "add record upload handling")
old_save_record = '''      await uploadFiles(selected.id, record.id, data.getAll("media") as File[], "record");
      await loadCases(selected.id);
      setEditingRecordId(null);'''
new_save_record = '''      const failedFiles = await uploadFiles(
        selected.id,
        record.id,
        data.getAll("media") as File[],
        "record",
      );
      await loadCases(selected.id);
      setEditingRecordId(null);
      const warning = uploadWarning("處理紀錄修改", failedFiles);
      if (warning) setError(warning);'''
text = replace_once(text, old_save_record, new_save_record, "save record upload handling")
old_history_record = '<RecordFields record={record} currentStatus={selected.status} currentProgress={selected.customStatus} busy={busy} onApplySuggestedStatus={updateStatus} />'
new_history_record = '<RecordFields record={record} currentStatus={selected.status} currentProgress={selected.customStatus} busy={busy} />'
text = replace_once(text, old_history_record, new_history_record, "historical record status suggestion")
old_close_date = '''            <div className="date-overview-item">
              <span>結案日期</span>
              <strong>{selected.status === "已結案" && selected.records[0] ? formatDate(selected.records[0].date) : "未結案"}</strong>
            </div>'''
new_close_date = '''            <div className="date-overview-item">
              <span>結案狀態</span>
              <strong>{selected.status === "已結案" ? "已結案" : "未結案"}</strong>
              <small>{selected.status === "已結案" ? "避免用舊處理日期誤當結案日期" : caseProgressLabel(selected) || "尚未設定目前進度"}</small>
            </div>'''
text = replace_once(text, old_close_date, new_close_date, "misleading close date")
path.write_text(text)


path = Path("app/api/cases/import/route.ts")
text = path.read_text()
old_progress = '''      const rowStatusText = clean(row.status);
      const normalizedStatus = normalizeCaseStatus(
        rowStatusText || defaultStatusText,
        clean(row.customStatus) || (rowStatusText ? "" : defaultStatus.customStatus),
      );'''
new_progress = '''      const rowStatusText = clean(row.status);
      const rowProgressText = clean(row.customStatus);
      const defaultProgress =
        !rowStatusText || rowStatusText === defaultStatusText
          ? defaultStatus.customStatus
          : "";
      const normalizedStatus = normalizeCaseStatus(
        rowStatusText || defaultStatusText,
        rowProgressText || defaultProgress,
      );'''
text = replace_once(text, old_progress, new_progress, "import default progress")
path.write_text(text)
