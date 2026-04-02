// tests/unit/modals/TaskCreationModal.subtask-type.test.ts
import { TaskCreationModal } from '../../../src/modals/TaskCreationModal';
import { TaskInfo } from '../../../src/types';
import { MockObsidian, TFile } from '../../__mocks__/obsidian';
import type { App } from 'obsidian';

jest.mock('obsidian');
jest.mock('../../../src/utils/helpers', () => ({
  calculateDefaultDate: jest.fn(() => '2025-01-15'),
  sanitizeTags: jest.fn((t: any) => t),
}));
jest.mock('../../../src/utils/dateUtils', () => ({
  getCurrentTimestamp: jest.fn(() => '2025-01-15T10:00:00.000+00:00'),
  hasTimeComponent: jest.fn(() => false),
  getDatePart: jest.fn((d: any) => d),
  normalizeDateString: jest.fn((d: any) => d),
  combineDateAndTime: jest.fn(),
  formatDateForStorage: jest.fn((d: any) => d),
}));
jest.mock('../../../src/utils/filenameGenerator', () => ({
  generateTaskFilename: jest.fn(() => 'test-task.md'),
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
    const rawApp = MockObsidian.createMockApp();
    // Make vault return TFile for any path so the early-return guard passes
    jest.spyOn(rawApp.vault, 'getAbstractFileByPath').mockImplementation((path: string) => new TFile(path));
    const mockApp = createMockApp(rawApp);

    const capturedFrontmatter: Record<string, any> = {};
    const processFrontMatterMock = jest.fn().mockImplementation(async (_file: any, fn: (fm: any) => void) => {
      fn(capturedFrontmatter);
    });

    const subtaskFile = new TFile('subtask.md');
    const subtaskInfo = makeTask({ path: 'subtask.md', title: 'Subtask', projects: [] });

    const mockPlugin: any = {
      app: {
        fileManager: {
          processFrontMatter: processFrontMatterMock,
          generateMarkdownLink: jest.fn().mockReturnValue('[[link]]'),
        },
        vault: rawApp.vault,
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

    const subtaskFile = new TFile('subtask.md');
    // subtaskInfo already has the project link that buildProjectReference returns
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
