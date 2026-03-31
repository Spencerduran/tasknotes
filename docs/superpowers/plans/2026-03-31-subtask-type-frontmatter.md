# Subtask Type Frontmatter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write `type: subtask` to frontmatter whenever a subtask relationship is established, so Bases views can filter subtasks with `type is not subtask`.

**Architecture:** Use `app.fileManager.processFrontMatter()` directly for both assign-existing-task paths. New subtask creation already works via `userFields`/`customFrontmatter` in the creation modal. The `FieldMapping`/`TaskInfo` type additions stay for read-path support.

**Tech Stack:** TypeScript, Obsidian plugin API (`fileManager.processFrontMatter`), Jest

---

## Files

- Modify: `src/components/TaskContextMenu.ts` — replace `updateTaskProperty("type")` with `processFrontMatter` in `assignTaskAsSubtask()`
- Modify: `src/modals/TaskCreationModal.ts` — add `processFrontMatter` type write in `applySubtaskAssignments()`
- Create: `tests/unit/components/TaskContextMenu.subtask-type.test.ts`
- Create: `tests/unit/modals/TaskCreationModal.subtask-type.test.ts`

No new files in `src/`. `src/types.ts` and `src/settings/defaults.ts` already have the needed `TaskInfo.type` and `FieldMapping.type` additions from prior commits — do not change them.

---

## Task 1: Test that `assignTaskAsSubtask` writes `type: subtask` via `processFrontMatter`

**Files:**
- Create: `tests/unit/components/TaskContextMenu.subtask-type.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/components/TaskContextMenu.subtask-type.test.ts
import { TaskContextMenu } from '../../../src/components/TaskContextMenu';
import { TaskInfo } from '../../../src/types';
import { TFile } from '../../__mocks__/obsidian';

jest.mock('obsidian');
jest.mock('../../../src/utils/dateUtils', () => ({
  formatDateForStorage: jest.fn((d) => d),
}));
jest.mock('../../../src/utils/linkUtils', () => ({
  generateLink: jest.fn(() => '[[parent-task]]'),
}));
jest.mock('../../../src/utils/helpers', () => ({
  calculateDefaultDate: jest.fn(),
  sanitizeTags: jest.fn(),
}));
jest.mock('../../../src/utils/timeblockPrefillUtils', () => ({
  buildTimeblockPrefillForTask: jest.fn(),
}));

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    path: 'test.md',
    title: 'Test',
    status: 'open',
    priority: 'normal',
    projects: [],
    ...overrides,
  } as TaskInfo;
}

function makePlugin(overrides: any = {}) {
  const capturedFrontmatter: Record<string, any> = {};
  const plugin = {
    app: {
      vault: {
        getAbstractFileByPath: jest.fn((path: string) => {
          const f = new TFile(path);
          return f;
        }),
      },
      fileManager: {
        processFrontMatter: jest.fn().mockImplementation(async (_file: any, fn: (fm: any) => void) => {
          fn(capturedFrontmatter);
        }),
      },
    },
    settings: {
      useFrontmatterMarkdownLinks: false,
      showExpandableSubtasks: false,
      subtaskChevronPosition: 'right',
    },
    i18n: {
      translate: jest.fn((key: string) => key),
    },
    updateTaskProperty: jest.fn().mockImplementation(async (task: TaskInfo, _prop: string, value: any) => {
      return { ...task, projects: value };
    }),
    openTaskCreationModal: jest.fn(),
    ...overrides,
  };
  return { plugin, capturedFrontmatter };
}

describe('TaskContextMenu.assignTaskAsSubtask', () => {
  it('calls processFrontMatter with type: subtask on the subtask file', async () => {
    const parentTask = makeTask({ path: 'parent.md', title: 'Parent' });
    const subtask = makeTask({ path: 'subtask.md', title: 'Subtask', projects: [] });
    const { plugin, capturedFrontmatter } = makePlugin();

    const menu = new TaskContextMenu({
      task: parentTask,
      plugin: plugin as any,
      targetDate: new Date(),
    });

    await (menu as any).assignTaskAsSubtask(parentTask, plugin, subtask);

    expect(plugin.app.fileManager.processFrontMatter).toHaveBeenCalled();
    expect(capturedFrontmatter.type).toBe('subtask');
  });

  it('does not call processFrontMatter if subtask is already linked', async () => {
    const parentTask = makeTask({ path: 'parent.md', title: 'Parent' });
    // Already contains the link that generateLink will return
    const subtask = makeTask({ path: 'subtask.md', title: 'Subtask', projects: ['[[parent-task]]'] });
    const { plugin } = makePlugin();

    const menu = new TaskContextMenu({
      task: parentTask,
      plugin: plugin as any,
      targetDate: new Date(),
    });

    await (menu as any).assignTaskAsSubtask(parentTask, plugin, subtask);

    expect(plugin.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/spencerduran/repos/tasknotes
npx jest tests/unit/components/TaskContextMenu.subtask-type.test.ts --no-coverage
```

Expected: FAIL — `processFrontMatter` is not called (current code uses `updateTaskProperty`).

---

## Task 2: Replace `updateTaskProperty("type")` with `processFrontMatter` in `assignTaskAsSubtask`

**Files:**
- Modify: `src/components/TaskContextMenu.ts:1054`

- [ ] **Step 3: Replace the broken call**

In `src/components/TaskContextMenu.ts`, find `assignTaskAsSubtask()` (line ~1029). Replace:

```typescript
await plugin.updateTaskProperty(subtask, "type", "subtask");
```

With:

```typescript
const subtaskFile = plugin.app.vault.getAbstractFileByPath(subtask.path);
if (subtaskFile instanceof TFile) {
    await plugin.app.fileManager.processFrontMatter(subtaskFile, (fm) => {
        fm.type = "subtask";
    });
}
```

`TFile` is already imported at line 1 of `TaskContextMenu.ts`.

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest tests/unit/components/TaskContextMenu.subtask-type.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/TaskContextMenu.ts tests/unit/components/TaskContextMenu.subtask-type.test.ts
git commit -m "fix: use processFrontMatter to stamp type:subtask in assignTaskAsSubtask"
```

---

## Task 3: Test that `applySubtaskAssignments` writes `type: subtask` via `processFrontMatter`

**Files:**
- Create: `tests/unit/modals/TaskCreationModal.subtask-type.test.ts`

- [ ] **Step 6: Write the failing test**

```typescript
// tests/unit/modals/TaskCreationModal.subtask-type.test.ts
import { TaskCreationModal } from '../../../src/modals/TaskCreationModal';
import { TaskInfo } from '../../../src/types';
import { MockObsidian, TFile } from '../../__mocks__/obsidian';
import type { App } from 'obsidian';

jest.mock('obsidian');
jest.mock('../../../src/utils/helpers', () => ({
  calculateDefaultDate: jest.fn(() => '2025-01-15'),
  sanitizeTags: jest.fn((t) => t),
}));
jest.mock('../../../src/utils/dateUtils', () => ({
  getCurrentTimestamp: jest.fn(() => '2025-01-15T10:00:00.000+00:00'),
  hasTimeComponent: jest.fn(() => false),
  getDatePart: jest.fn((d) => d),
  normalizeDateString: jest.fn((d) => d),
  combineDateAndTime: jest.fn(),
  formatDateForStorage: jest.fn((d) => d),
}));
jest.mock('../../../src/utils/filenameGenerator', () => ({
  generateTaskFilename: jest.fn(() => 'test-task.md'),
}));

const createMockApp = (mockApp: any): App => mockApp as unknown as App;

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    path: 'test.md',
    title: 'Test',
    status: 'open',
    priority: 'normal',
    projects: [],
    ...overrides,
  } as TaskInfo;
}

describe('TaskCreationModal.applySubtaskAssignments', () => {
  it('calls processFrontMatter with type: subtask for each assigned subtask', async () => {
    MockObsidian.reset();
    const mockApp = createMockApp(MockObsidian.createMockApp());

    const capturedFrontmatter: Record<string, any> = {};
    const processFrontMatterMock = jest.fn().mockImplementation(async (_file: any, fn: (fm: any) => void) => {
      fn(capturedFrontmatter);
    });

    const subtaskFile = new TFile('subtask.md');
    const subtaskInfo = makeTask({ path: 'subtask.md', title: 'Subtask', projects: [] });

    const mockPlugin: any = {
      app: {
        ...mockApp,
        fileManager: {
          processFrontMatter: processFrontMatterMock,
          generateMarkdownLink: jest.fn().mockReturnValue('[[link]]'),
        },
        vault: {
          getAbstractFileByPath: jest.fn((path: string) => new TFile(path)),
        },
      },
      settings: {
        defaultTaskPriority: 'normal',
        defaultTaskStatus: 'open',
        taskTag: 'task',
        taskIdentificationMethod: 'tag',
        taskCreationDefaults: {
          defaultDueDate: 'none',
          defaultScheduledDate: 'today',
          defaultContexts: '',
          defaultTags: '',
          defaultTimeEstimate: 0,
          defaultRecurrence: 'none',
          defaultReminders: [],
        },
        customStatuses: [],
        customPriorities: [],
        enableNaturalLanguageInput: false,
        nlpDefaultToScheduled: false,
        useFrontmatterMarkdownLinks: false,
      },
      cacheManager: {
        getAllContexts: jest.fn().mockReturnValue([]),
        getAllTags: jest.fn().mockReturnValue([]),
        getTaskInfo: jest.fn().mockResolvedValue(subtaskInfo),
      },
      taskService: { createTask: jest.fn() },
      i18n: { translate: jest.fn((key: string) => key) },
      updateTaskProperty: jest.fn().mockImplementation(async (task: TaskInfo, _prop: string, value: any) => ({
        ...task,
        projects: value,
      })),
    };

    const modal = new TaskCreationModal(mockApp, mockPlugin);
    // Inject a selected subtask file
    (modal as any).selectedSubtaskFiles = [subtaskFile];

    const createdTask = makeTask({ path: 'new-parent.md', title: 'New Parent' });
    await (modal as any).applySubtaskAssignments(createdTask);

    expect(processFrontMatterMock).toHaveBeenCalled();
    expect(capturedFrontmatter.type).toBe('subtask');
  });

  it('skips processFrontMatter if subtask is already linked to parent', async () => {
    MockObsidian.reset();
    const mockApp = createMockApp(MockObsidian.createMockApp());
    const processFrontMatterMock = jest.fn();

    // subtaskInfo already has the project link that buildProjectReference returns
    const subtaskFile = new TFile('subtask.md');
    const subtaskInfo = makeTask({
      path: 'subtask.md',
      projects: ['[[new-parent]]'],
    });

    const mockPlugin: any = {
      app: {
        ...mockApp,
        fileManager: {
          processFrontMatter: processFrontMatterMock,
          generateMarkdownLink: jest.fn().mockReturnValue('[[link]]'),
        },
        vault: {
          getAbstractFileByPath: jest.fn((path: string) => new TFile(path)),
        },
      },
      settings: {
        defaultTaskPriority: 'normal',
        defaultTaskStatus: 'open',
        taskTag: 'task',
        taskIdentificationMethod: 'tag',
        taskCreationDefaults: {
          defaultDueDate: 'none',
          defaultScheduledDate: 'today',
          defaultContexts: '',
          defaultTags: '',
          defaultTimeEstimate: 0,
          defaultRecurrence: 'none',
          defaultReminders: [],
        },
        customStatuses: [],
        customPriorities: [],
        enableNaturalLanguageInput: false,
        nlpDefaultToScheduled: false,
        useFrontmatterMarkdownLinks: false,
      },
      cacheManager: {
        getAllContexts: jest.fn().mockReturnValue([]),
        getAllTags: jest.fn().mockReturnValue([]),
        getTaskInfo: jest.fn().mockResolvedValue(subtaskInfo),
      },
      taskService: { createTask: jest.fn() },
      i18n: { translate: jest.fn((key: string) => key) },
      updateTaskProperty: jest.fn(),
    };

    const modal = new TaskCreationModal(mockApp, mockPlugin);
    (modal as any).selectedSubtaskFiles = [subtaskFile];

    // buildProjectReference returns '[[new-parent]]' which matches subtaskInfo.projects
    jest.spyOn(modal as any, 'buildProjectReference').mockReturnValue('[[new-parent]]');

    const createdTask = makeTask({ path: 'new-parent.md', title: 'New Parent' });
    await (modal as any).applySubtaskAssignments(createdTask);

    expect(processFrontMatterMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run test to confirm it fails**

```bash
npx jest tests/unit/modals/TaskCreationModal.subtask-type.test.ts --no-coverage
```

Expected: FAIL — `processFrontMatter` is never called (`applySubtaskAssignments` currently has no type write).

---

## Task 4: Add `processFrontMatter` type write to `applySubtaskAssignments`

**Files:**
- Modify: `src/modals/TaskCreationModal.ts:1414`

- [ ] **Step 8: Add the write**

In `src/modals/TaskCreationModal.ts`, find `applySubtaskAssignments()` (line ~1392). After the `updateTaskProperty` call for `projects`, add:

```typescript
// Before (existing line ~1414):
await this.plugin.updateTaskProperty(subtaskInfo, "projects", updatedProjects);

// After — add these lines immediately after:
if (subtaskFile instanceof TFile) {
    await this.plugin.app.fileManager.processFrontMatter(subtaskFile, (fm) => {
        fm.type = "subtask";
    });
}
```

`TFile` is already imported in `TaskCreationModal.ts` (line 8). `subtaskFile` in this loop is typed as `TAbstractFile` — the `instanceof TFile` guard is required.

- [ ] **Step 9: Run test to confirm it passes**

```bash
npx jest tests/unit/modals/TaskCreationModal.subtask-type.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 10: Run full test suite to check for regressions**

```bash
npx jest --no-coverage 2>&1 | tail -20
```

Expected: All previously-passing tests still pass.

- [ ] **Step 11: Commit**

```bash
git add src/modals/TaskCreationModal.ts tests/unit/modals/TaskCreationModal.subtask-type.test.ts
git commit -m "fix: use processFrontMatter to stamp type:subtask in applySubtaskAssignments"
```

---

## Task 5: Squash Spencer's commits into a clean history

The branch has 5 Spencer code commits (3 original + 2 new fixes) and 1 spec doc commit. Squash the 5 code commits into one. The spec doc commit stays.

- [ ] **Step 12: Identify the base commit (last upstream commit before Spencer's work)**

```bash
git log --oneline --format="%h %ae %s" | grep -v "Spencerduran" | head -1
```

Note the hash — this is `<upstream-head>`. Also note the hash of the spec commit:

```bash
git log --oneline --format="%h %ae %s" | grep "spec"
```

Note that hash as `<spec-hash>`.

- [ ] **Step 13: Reset to upstream, recommit code changes, cherry-pick spec**

```bash
# Soft reset removes Spencer's commits but leaves all changes staged
git reset --soft <upstream-head>

# Recommit everything in one clean commit
git commit -m "feat: stamp type:subtask on subtask frontmatter

- Add type?: string to TaskInfo and FieldMapping for read-path support
- Pass type: subtask via prePopulatedValues in openTaskCreationModal
- Handle type in TaskCreationModal.applyPrePopulatedValues
- Use processFrontMatter to write type:subtask in assignTaskAsSubtask
- Use processFrontMatter to write type:subtask in applySubtaskAssignments"

# Re-apply the spec doc commit on top
git cherry-pick <spec-hash>
```

- [ ] **Step 14: Verify log is clean**

```bash
git log --oneline -5
```

Expected: spec doc commit on top, one clean feat commit below it, then upstream commits.

---

## Task 6: Build and deploy to Obsidian

- [ ] **Step 15: Build the plugin**

```bash
cd /Users/spencerduran/repos/tasknotes
npm run build 2>&1 | tail -10
```

Expected: Build succeeds, `main.js` produced in repo root.

- [ ] **Step 16: Copy built files to Obsidian**

```bash
cp main.js styles.css manifest.json /Users/spencerduran/vaults/mind_forge/.obsidian/plugins/tasknotes/
```

- [ ] **Step 17: Verify installed version**

```bash
grep '"version"' /Users/spencerduran/vaults/mind_forge/.obsidian/plugins/tasknotes/manifest.json
grep -c "processFrontMatter" /Users/spencerduran/vaults/mind_forge/.obsidian/plugins/tasknotes/main.js
```

Expected: Version matches repo, `processFrontMatter` match count > 0.

Reload the plugin in Obsidian (Settings → Community Plugins → disable/enable TaskNotes), assign a subtask, and verify `type: subtask` appears in the note's frontmatter.
