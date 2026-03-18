# agent-mux-desktop: Tauri Desktop App Design Spec

## Overview

cmux 스타일의 네이티브 데스크탑 앱. 다중 AI 코딩 에이전트(Claude Code, Codex)를 동시에 실행하고 관리하는 멀티플렉서.

**Tech Stack:** Tauri 2 (Rust) + React 19 + Tailwind CSS 4 + xterm.js

## Architecture

```
┌─────────────────────────────────────────────┐
│              Tauri Shell (Rust)              │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Window  │  │ Sidecar  │  │  Shell    │  │
│  │ Manager │  │ (node.js)│  │  Commands │  │
│  └─────────┘  └──────────┘  └───────────┘  │
│         ↕ IPC (invoke/events)               │
│  ┌──────────────────────────────────────┐   │
│  │         React Frontend               │   │
│  │  ┌────────┬──────────────────────┐   │   │
│  │  │Sidebar │    Workspace Area    │   │   │
│  │  │        │  ┌──────┬─────────┐  │   │   │
│  │  │ [ws1]  │  │ Pane │  Pane   │  │   │   │
│  │  │ [ws2]◀─│  │ term │  term   │  │   │   │
│  │  │ [ws3]  │  │      │         │  │   │   │
│  │  │        │  └──────┴─────────┘  │   │   │
│  │  │ [+new] │  [input bar]         │   │   │
│  │  └────────┴──────────────────────┘   │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Core Features

### 1. Vertical Tabs Sidebar
- 좌측 세로 탭으로 모든 워크스페이스 표시
- 각 탭: 에이전트 아이콘, 작업명, git 브랜치, 상태 뱃지
- 읽지 않은 출력/알림 카운터
- 드래그 앤 드롭 재정렬
- `+` 버튼으로 새 워크스페이스 생성

### 2. Workspace & Split Panes
- 각 워크스페이스 = 독립 에이전트 세션
- 수평/수직 분할 (Cmd+D, Cmd+Shift+D)
- 패널 간 방향키 네비게이션 (Cmd+[arrows])
- 패널 리사이즈 (드래그)
- 최대 4개 패널 per workspace

### 3. Terminal Emulator (xterm.js)
- 각 패널에 독립 터미널 인스턴스
- PTY 기반 실제 쉘 세션 (Tauri shell plugin)
- 에이전트 출력 실시간 스트리밍
- ANSI 색상, 커서 지원
- 스크롤백 버퍼 (10,000줄)
- 검색 (Cmd+F)

### 4. Agent Integration
- agent-mux 코어 엔진을 Node.js sidecar로 실행
- 자동 라우팅: Claude Code ↔ Codex
- 라우팅 결정 시각화 (confidence bar)
- 예산 트래킹 (사이드바 하단 progress bar)
- 작업 분해 (mux go) 지원

### 5. Notification System
- 에이전트가 입력 필요 시 패널 테두리 파란색 글로우
- 사이드바 탭에 알림 뱃지
- Cmd+Shift+U: 가장 최근 알림으로 점프
- macOS 네이티브 알림 연동 (Tauri notification plugin)

### 6. Input Bar
- 하단 고정 입력 영역
- 슬래시 커맨드 자동완성 (/route, /status, /config)
- 에이전트 선택 드롭다운 (claude/codex/auto)
- 히스토리 (위/아래 화살표)

### 7. Status Bar
- 하단: 현재 에이전트, 예산 잔여량, git 브랜치, 워킹 디렉토리
- 실시간 토큰 사용량 표시

## Design System

### Colors (Dark Theme)
- Background: `#0a0a0a` (main), `#111111` (sidebar), `#1a1a1a` (pane)
- Border: `#262626`
- Text: `#e5e5e5` (primary), `#737373` (secondary)
- Accent: `#3b82f6` (blue, notifications), `#22c55e` (green, success)
- Claude: `#d97706` (amber), Codex: `#8b5cf6` (purple)
- Error: `#ef4444`

### Typography
- Mono: `"SF Mono", "JetBrains Mono", "Fira Code", monospace`
- UI: `"Inter", -apple-system, sans-serif`
- Size: 13px (terminal), 12px (UI), 11px (badges)

### Spacing
- Sidebar width: 220px (collapsible to 48px)
- Pane gap: 2px
- Padding: 8px (compact), 12px (normal)

## Project Structure

```
packages/agent-mux-desktop/
├── package.json
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── commands/        # Tauri IPC commands
│   │   │   ├── mod.rs
│   │   │   ├── shell.rs     # PTY spawn/write/resize
│   │   │   ├── agent.rs     # Agent spawn/route/stream
│   │   │   └── workspace.rs # Workspace CRUD
│   │   └── pty/             # PTY management
│   │       ├── mod.rs
│   │       └── manager.rs
│   └── capabilities/
│       └── default.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/
│   │   └── globals.css      # Tailwind + custom theme
│   ├── components/
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── WorkspaceTab.tsx
│   │   │   ├── BudgetBar.tsx
│   │   │   └── NewWorkspaceButton.tsx
│   │   ├── Workspace/
│   │   │   ├── Workspace.tsx
│   │   │   ├── PaneLayout.tsx
│   │   │   └── PaneDivider.tsx
│   │   ├── Terminal/
│   │   │   ├── TerminalPane.tsx
│   │   │   └── TerminalTheme.ts
│   │   ├── InputBar/
│   │   │   ├── InputBar.tsx
│   │   │   └── CommandPalette.tsx
│   │   ├── StatusBar/
│   │   │   └── StatusBar.tsx
│   │   └── Notifications/
│   │       ├── NotificationRing.tsx
│   │       └── NotificationBadge.tsx
│   ├── hooks/
│   │   ├── useWorkspaces.ts
│   │   ├── useTerminal.ts
│   │   ├── useAgent.ts
│   │   ├── usePanes.ts
│   │   └── useKeyboard.ts
│   ├── stores/
│   │   ├── workspaceStore.ts  # Zustand
│   │   ├── agentStore.ts
│   │   └── settingsStore.ts
│   └── lib/
│       ├── tauri-commands.ts  # Typed IPC wrappers
│       ├── keybindings.ts
│       └── theme.ts
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+N | 새 워크스페이스 |
| Cmd+W | 워크스페이스 닫기 |
| Cmd+1-9 | 워크스페이스 전환 |
| Cmd+D | 수직 분할 |
| Cmd+Shift+D | 수평 분할 |
| Cmd+[arrows] | 패널 이동 |
| Cmd+Shift+U | 최근 알림으로 점프 |
| Cmd+K | 커맨드 팔레트 |
| Cmd+L | 입력바 포커스 |
| Cmd+Shift+[ ] | 이전/다음 워크스페이스 |

## Implementation Phases

### Phase 1: Shell (이번 세션)
- Tauri 2 프로젝트 생성
- React + Tailwind + Zustand 설정
- 사이드바 + 워크스페이스 레이아웃
- xterm.js 터미널 연동
- PTY 스폰 (Tauri shell)
- 기본 다크 테마

### Phase 2: Agent Integration
- agent-mux 코어 엔진 sidecar 연동
- 에이전트 스트리밍 출력 → 터미널 표시
- 라우팅 시각화
- 예산 트래킹 UI

### Phase 3: Polish
- 알림 시스템
- 키보드 단축키 전체 구현
- 분할 패널 리사이즈
- 설정 페이지
- macOS 네이티브 알림
