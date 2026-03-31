# Design: Stamp `type: subtask` on Subtask Frontmatter

**Date:** 2026-03-31
**Status:** Approved

## Problem

Tasknotes has no built-in mechanism to identify subtasks. They appear both nested under their parent (via the chevron expand) and as standalone items in every task list view. There is no way to filter them out in Bases because nothing distinguishes a subtask from a regular task at the data level.

## Goal

Write `type: subtask` to a subtask's YAML frontmatter whenever the subtask relationship is established — at creation or on assignment. This lets Bases views filter subtasks out with a simple `type is not subtask` condition.

## Approach

Use `app.fileManager.processFrontMatter()` directly for the assign-existing-task paths. This writes arbitrary frontmatter keys without needing a registered field mapping, which is appropriate since `type` is a custom field, not a built-in tasknotes concept.

## Code Paths

### 1. New subtask created from context menu (no change needed)

`TaskContextMenu.ts` already calls:

```ts
plugin.openTaskCreationModal({
  projects: [projectReference],
  type: "subtask",
});
```

`TaskCreationModal.applyPrePopulatedValues()` handles the `type` value by storing it in `this.userFields['type']`. `buildCustomFrontmatter()` includes it in the custom frontmatter dict, which `TaskCreationService.createTask()` merges into the final YAML at file creation time.

No changes needed for this path.

### 2. Existing task assigned as subtask via context menu

**File:** `src/components/TaskContextMenu.ts`
**Method:** `assignTaskAsSubtask()`

Replace the existing `updateTaskProperty(subtask, "type", "subtask")` call with a direct `processFrontMatter` call:

```ts
const subtaskFile = plugin.app.vault.getAbstractFileByPath(subtask.path);
if (subtaskFile instanceof TFile) {
  await plugin.app.fileManager.processFrontMatter(subtaskFile, (fm) => {
    fm.type = "subtask";
  });
}
```

This runs immediately after the `projects` field is written, in the same try block.

### 3. Existing tasks assigned as subtasks during task creation modal

**File:** `src/modals/TaskCreationModal.ts`
**Method:** `applySubtaskAssignments()`

This path currently writes `projects` but never writes `type`. Add the same `processFrontMatter` call after the `updateTaskProperty("projects", ...)` line:

```ts
const subtaskFile = this.plugin.app.vault.getAbstractFileByPath(subtaskInfo.path);
if (subtaskFile instanceof TFile) {
  await this.plugin.app.fileManager.processFrontMatter(subtaskFile, (fm) => {
    fm.type = "subtask";
  });
}
```

## Supporting Types (keep)

- `TaskInfo.type?: string` — allows the plugin to read `type` from frontmatter into its data model
- `FieldMapping.type: string` — maps the frontmatter key for read operations
- `DEFAULT_FIELD_MAPPING.type: "type"` — default frontmatter key is `"type"`

`DEFAULT_FIELD_MAPPING.type` is no longer required for the write path but is kept so the plugin can surface `type` in `TaskInfo` for any future logic that needs it.

## What's Removed

- The `updateTaskProperty(subtask, "type", "subtask")` call in `assignTaskAsSubtask()` — replaced by `processFrontMatter`
- Dependency on field mapping for the write path

## Out of Scope

- Backfilling existing subtasks that were assigned before this change
- Removing `type: subtask` if a subtask is detached from its parent
- Using `type` for anything other than frontmatter presence (no plugin-side filtering logic)
