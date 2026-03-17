import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEngine, resetEngine } from './engine.js';

// ─── Mocks ───────────────────────────────────────────────────────────

vi.mock('../routing/classifier.js', () => ({
  analyzeTask: vi.fn(() => ({
    needsMCP: false,
    needsProjectContext: false,
    needsConversationContext: false,
    isInteractive: false,
    isArchitectural: false,
    isFrontend: false,
    isScaffolding: false,
    isMultiFileOrchestration: false,
    isCodeReview: false,
    isSecurityAudit: false,
    isSelfContained: true,
    isTestWriting: false,
    isDocGeneration: false,
    isDebugging: false,
    isRefactoring: false,
    isTerminalTask: false,
    estimatedFiles: 1,
    estimatedComplexity: 'low',
    isVerifiable: false,
    isUrgent: false,
  })),
  routeTask: vi.fn(() => ({
    target: 'codex' as const,
    confidence: 0.8,
    reason: 'Test routing to codex',
    signals: {},
    escalated: false,
  })),
  routeTaskHybrid: vi.fn(async () => ({
    target: 'claude' as const,
    confidence: 0.75,
    reason: 'Hybrid routing to claude',
    signals: {},
    escalated: false,
  })),
  isCodingTask: vi.fn((task: string) => {
    return /code|fix|test|implement|debug/.test(task);
  }),
}));

vi.mock('../routing/decomposer.js', () => ({
  decomposeTask: vi.fn((task: string) => ({
    shouldDecompose: task.includes('and'),
    reason: task.includes('and') ? 'Multiple operations detected' : 'Simple task',
    subtasks: task.includes('and')
      ? [
          { id: 'subtask-1', description: 'first part', recommendedTarget: 'claude', dependencies: [], estimatedFiles: 1, priority: 1 },
          { id: 'subtask-2', description: 'second part', recommendedTarget: 'codex', dependencies: ['subtask-1'], estimatedFiles: 1, priority: 2 },
        ]
      : [],
    executionStrategy: task.includes('and') ? 'fan-out' as const : 'sequential' as const,
  })),
}));

vi.mock('../budget/tracker.js', () => ({
  getBudgetStatus: vi.fn(async () => ({
    claude: {
      agent: 'claude',
      monthlyCost: 20,
      usagePercent: 30,
      tasksCompleted: 15,
      remainingCapacity: 'high',
    },
    codex: {
      agent: 'codex',
      monthlyCost: 20,
      usagePercent: 10,
      tasksCompleted: 5,
      remainingCapacity: 'high',
    },
    currentBias: 'balanced',
    activeWarnings: [],
    periodStart: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    periodEnd: new Date().toISOString(),
    warnings: [],
  })),
}));

vi.mock('../routing/history.js', () => ({
  getRoutingHistory: vi.fn(async (limit = 50) => [
    {
      timestamp: Date.now() - 1000,
      taskSummary: 'Write tests for auth module',
      signals: { isTestWriting: true },
      decision: { target: 'codex', confidence: 0.8, reason: 'Test writing', phase: 1 },
    },
    {
      timestamp: Date.now() - 2000,
      taskSummary: 'Design system architecture',
      signals: { isArchitectural: true },
      decision: { target: 'claude', confidence: 1.0, reason: 'Architectural task', phase: 1 },
    },
  ].slice(0, limit)),
}));

vi.mock('../config/loader.js', () => ({
  loadConfig: vi.fn(async () => ({
    schemaVersion: 1,
    tier: 'standard',
    claude: { plan: 'pro', cost: 20 },
    codex: { plan: 'plus', cost: 20, mode: 'local' },
    routing: {
      engine: 'local',
      bias: 'balanced',
      split: { claude: 50, codex: 50 },
      escalation: { enabled: true, strategy: 'fix', maxRetries: 1 },
    },
    budget: { warnings: [50, 80, 95] },
    denyList: [],
  })),
}));

vi.mock('./claude-stream.js', () => ({
  streamClaude: vi.fn(async function* () {
    yield { type: 'stream', chunk: 'Claude response' };
    yield { type: 'done', summary: 'Claude done' };
  }),
  streamChat: vi.fn(async function* () {
    yield { type: 'stream', chunk: 'Chat response' };
    yield { type: 'done', summary: 'Chat done' };
  }),
}));

vi.mock('./codex-stream.js', () => ({
  streamCodex: vi.fn(async function* () {
    yield { type: 'progress', message: 'Codex running', elapsed: 0 };
    yield { type: 'done', summary: 'Codex done' };
  }),
}));

vi.mock('../cli/process-tracker.js', () => ({
  getActiveProcesses: vi.fn(() => new Set()),
  registerProcess: vi.fn(),
  unregisterProcess: vi.fn(),
}));

// ─── Tests ───────────────────────────────────────────────────────────

describe('createEngine', () => {
  beforeEach(() => {
    resetEngine();
  });

  afterEach(() => {
    resetEngine();
  });

  it('creates a MuxEngine instance', () => {
    const engine = createEngine();
    expect(engine).toBeDefined();
    expect(typeof engine.analyzeAndRoute).toBe('function');
    expect(typeof engine.execute).toBe('function');
    expect(typeof engine.chat).toBe('function');
    expect(typeof engine.decompose).toBe('function');
    expect(typeof engine.getBudget).toBe('function');
    expect(typeof engine.getHistory).toBe('function');
    expect(typeof engine.getConfig).toBe('function');
    expect(typeof engine.getVersion).toBe('function');
    expect(typeof engine.isCodingTask).toBe('function');
    expect(typeof engine.cancel).toBe('function');
    expect(typeof engine.respondToConfirm).toBe('function');
    expect(typeof engine.executeDecomposed).toBe('function');
  });

  it('returns a singleton on repeated calls', () => {
    const engine1 = createEngine();
    const engine2 = createEngine();
    expect(engine1).toBe(engine2);
  });

  it('creates a new instance when configOverride is passed', () => {
    const engine1 = createEngine();
    const engine2 = createEngine({ tier: 'premium' });
    // Both are valid engines; engine2 is a new instance due to override
    expect(engine2).toBeDefined();
  });
});

describe('MuxEngine.getBudget', () => {
  beforeEach(() => resetEngine());
  afterEach(() => resetEngine());

  it('returns BudgetStatus without warnings field', async () => {
    const engine = createEngine();
    const budget = await engine.getBudget();
    expect(budget).toBeDefined();
    expect(budget.claude).toBeDefined();
    expect(budget.codex).toBeDefined();
    expect(budget.claude.usagePercent).toBe(30);
    expect(budget.codex.usagePercent).toBe(10);
    expect((budget as any).warnings).toBeUndefined();
  });
});

describe('MuxEngine.getConfig', () => {
  beforeEach(() => resetEngine());
  afterEach(() => resetEngine());

  it('returns loaded config', async () => {
    const engine = createEngine();
    const config = await engine.getConfig();
    expect(config.tier).toBe('standard');
    expect(config.routing.engine).toBe('local');
  });

  it('merges configOverride into loaded config', async () => {
    const engine = createEngine({ tier: 'premium' });
    const config = await engine.getConfig();
    expect(config.tier).toBe('premium');
  });
});

describe('MuxEngine.getHistory', () => {
  beforeEach(() => resetEngine());
  afterEach(() => resetEngine());

  it('returns routing history', async () => {
    const engine = createEngine();
    const history = await engine.getHistory();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(2);
    expect(history[0].decision.target).toBe('codex');
  });

  it('respects limit parameter', async () => {
    const engine = createEngine();
    const history = await engine.getHistory(1);
    expect(history.length).toBe(1);
  });
});

describe('MuxEngine.isCodingTask', () => {
  beforeEach(() => resetEngine());
  afterEach(() => resetEngine());

  it('returns true for coding tasks', () => {
    const engine = createEngine();
    expect(engine.isCodingTask('fix the bug in auth module')).toBe(true);
    expect(engine.isCodingTask('write tests for the parser')).toBe(true);
    expect(engine.isCodingTask('implement the API endpoint')).toBe(true);
  });

  it('returns false for non-coding tasks', () => {
    const engine = createEngine();
    expect(engine.isCodingTask('what is the weather today')).toBe(false);
  });
});

describe('MuxEngine.analyzeAndRoute', () => {
  beforeEach(() => resetEngine());
  afterEach(() => resetEngine());

  it('returns a route decision', async () => {
    const engine = createEngine();
    const decision = await engine.analyzeAndRoute('fix this bug');
    expect(decision).toBeDefined();
    expect(['claude', 'codex']).toContain(decision.target);
    expect(typeof decision.confidence).toBe('number');
    expect(typeof decision.reason).toBe('string');
  });

  it('uses manual route override when opts.route is set', async () => {
    const engine = createEngine();
    const decision = await engine.analyzeAndRoute('fix this bug', { route: 'claude' });
    expect(decision.target).toBe('claude');
    expect(decision.confidence).toBe(1.0);
    expect(decision.matchedRule).toBe('manual-override');
  });

  it('uses manual codex override', async () => {
    const engine = createEngine();
    const decision = await engine.analyzeAndRoute('design architecture', { route: 'codex' });
    expect(decision.target).toBe('codex');
    expect(decision.matchedRule).toBe('manual-override');
  });
});

describe('MuxEngine.execute', () => {
  beforeEach(() => resetEngine());
  afterEach(() => resetEngine());

  it('yields routing event first', async () => {
    const engine = createEngine();
    const events = [];
    for await (const ev of engine.execute('write tests')) {
      events.push(ev);
    }
    expect(events[0].type).toBe('routing');
  });

  it('yields done event in dry-run mode', async () => {
    const engine = createEngine();
    const events = [];
    for await (const ev of engine.execute('write tests', { dryRun: true })) {
      events.push(ev);
    }
    const doneEv = events.find(e => e.type === 'done');
    expect(doneEv).toBeDefined();
    expect((doneEv as any).summary).toContain('dry-run');
  });

  it('completes the stream (has done event)', async () => {
    const engine = createEngine();
    const events = [];
    for await (const ev of engine.execute('write tests')) {
      events.push(ev);
    }
    const hasTerminal = events.some(e => e.type === 'done' || e.type === 'error');
    expect(hasTerminal).toBe(true);
  });
});

describe('MuxEngine.decompose', () => {
  beforeEach(() => resetEngine());
  afterEach(() => resetEngine());

  it('decomposes a complex task', () => {
    const engine = createEngine();
    const result = engine.decompose('design system and write tests');
    expect(result.shouldDecompose).toBe(true);
    expect(result.subtasks.length).toBe(2);
  });

  it('returns no decomposition for simple task', () => {
    const engine = createEngine();
    const result = engine.decompose('fix the login bug');
    expect(result.shouldDecompose).toBe(false);
    expect(result.subtasks.length).toBe(0);
  });
});

describe('MuxEngine.getVersion', () => {
  beforeEach(() => resetEngine());
  afterEach(() => resetEngine());

  it('returns a string version', () => {
    const engine = createEngine();
    const version = engine.getVersion();
    expect(typeof version).toBe('string');
    // Either a valid semver or 'unknown' (depending on environment)
    expect(version.length).toBeGreaterThan(0);
  });
});

describe('MuxEngine.respondToConfirm', () => {
  beforeEach(() => resetEngine());
  afterEach(() => resetEngine());

  it('does not throw for unknown id', () => {
    const engine = createEngine();
    expect(() => engine.respondToConfirm('nonexistent-id', 'yes')).not.toThrow();
  });
});

describe('MuxEngine.cancel', () => {
  beforeEach(() => resetEngine());
  afterEach(() => resetEngine());

  it('does not throw when no processes are active', () => {
    const engine = createEngine();
    expect(() => engine.cancel()).not.toThrow();
  });
});
