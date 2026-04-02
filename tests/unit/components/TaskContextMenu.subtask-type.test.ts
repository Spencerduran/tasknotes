// tests/unit/components/TaskContextMenu.subtask-type.test.ts
import { TaskContextMenu } from '../../../src/components/TaskContextMenu';
import { TaskInfo } from '../../../src/types';
import { TFile } from '../../__mocks__/obsidian';

jest.mock('obsidian');

// Obsidian provides moment on the global window object
function makeMomentObj(): any {
  const obj: any = {
    add: jest.fn().mockReturnThis(),
    subtract: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnValue('2025-01-15'),
    toDate: jest.fn().mockReturnValue(new Date()),
    isValid: jest.fn().mockReturnValue(true),
    clone: jest.fn().mockImplementation(() => makeMomentObj()),
    startOf: jest.fn().mockReturnThis(),
    endOf: jest.fn().mockReturnThis(),
    isSame: jest.fn().mockReturnValue(false),
    isBefore: jest.fn().mockReturnValue(false),
    isAfter: jest.fn().mockReturnValue(false),
    diff: jest.fn().mockReturnValue(0),
  };
  return obj;
}
const mockMoment: any = jest.fn().mockImplementation(() => makeMomentObj());
mockMoment.isMoment = jest.fn().mockReturnValue(false);
(window as any).moment = mockMoment;
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
jest.mock('../../../src/components/DateContextMenu', () => ({
  DateContextMenu: jest.fn().mockImplementation(() => ({
    buildMenu: jest.fn(),
    addToMenu: jest.fn(),
    getDateOptions: jest.fn().mockReturnValue([]),
  })),
}));
jest.mock('../../../src/services/NaturalLanguageParser', () => {
  const mockParserInstance = {
    parseInput: jest.fn((input: string) => ({ title: input, tags: [], details: '' })),
  };
  const MockNaturalLanguageParser = Object.assign(
    jest.fn().mockImplementation(() => mockParserInstance),
    { fromPlugin: jest.fn(() => mockParserInstance) }
  );
  return { NaturalLanguageParser: MockNaturalLanguageParser };
});

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
      customStatuses: [],
      customPriorities: [],
    },
    priorityManager: {
      getPrioritiesByWeight: jest.fn().mockReturnValue([]),
    },
    cacheManager: {
      getAllContexts: jest.fn().mockReturnValue([]),
      getAllTags: jest.fn().mockReturnValue([]),
      getTaskInfo: jest.fn().mockResolvedValue(null),
    },
    taskService: {
      toggleRecurringTaskSkipped: jest.fn(),
      updateBlockingRelationships: jest.fn(),
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
  beforeEach(() => {
    // Stub buildMenu so the constructor doesn't eagerly instantiate
    // all the menu items and trigger cascade of dependency errors.
    jest.spyOn(TaskContextMenu.prototype as any, 'buildMenu').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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
