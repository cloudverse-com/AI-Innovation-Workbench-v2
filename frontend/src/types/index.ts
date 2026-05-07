// ─── Core message types ───────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolsUsed?: ToolCallInfo[];
  metadata?: Record<string, unknown>;
}

export interface ToolCallInfo {
  tool: string;
  args: Record<string, unknown>;
  result?: string;
}

// ─── Demo definitions ─────────────────────────────────────────────────────

export type DemoCategory =
  | 'Core Capabilities'
  | 'Advanced Features'
  | 'Agent Patterns'
  | 'Workflows'
  | 'Advanced';

export interface Demo {
  id: string;              // e.g. "demo01"
  routeId: string;         // e.g. "demo-01" (matches backend prefix)
  title: string;
  subtitle: string;
  category: DemoCategory;
  icon: string;            // emoji icon
  description: string;
  highlights: string[];    // bullet points shown in the UI
  supportsFileUpload?: boolean;
  supportsStreaming?: boolean;
  supportsSession?: boolean;
  inputLabel?: string;     // Custom label for the input box
  inputPlaceholder?: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────

export interface SystemPrompt {
  name: string;
  prompt: string;
}

export interface AppSettings {
  model: string;
  systemPrompt: SystemPrompt;
  processingMode: 'text' | 'vision';
  apiKey: string;
}

// ─── API types ────────────────────────────────────────────────────────────

export interface ModelsResponse {
  models: string[];
  default: string;
}

export interface SystemPromptsResponse {
  system_prompts: SystemPrompt[];
}

export interface ChatRequest {
  message: string;
  model: string;
  system_prompt: string;
  history: Array<{ role: string; content: string }>;
}

// ─── SSE streaming ────────────────────────────────────────────────────────

export interface SSETokenEvent {
  token?: string;
  done?: boolean;
  error?: string;
  type?: string;
  section?: number;
  progress_pct?: number;
  [key: string]: unknown;
}

// ─── Workflow / pipeline types ────────────────────────────────────────────

export interface PipelineStageResult {
  id: string;
  name: string;
  output: string;
  duration_seconds: number;
  success: boolean;
  error?: string;
}

export interface WorkflowResult {
  pipeline?: string;
  final_output: string;
  stages?: PipelineStageResult[];
  total_duration_seconds?: number;
  success: boolean;
}

// ─── Parallel workflow ────────────────────────────────────────────────────

export interface ExpertPerspective {
  agent: string;
  perspective: string;
  analysis: string;
  duration_seconds: number;
  success: boolean;
  error?: string;
}

export interface ParallelResult {
  question: string;
  synthesis?: string;
  expert_perspectives: ExpertPerspective[];
  timing: {
    parallel_wall_time_seconds: number;
    total_time_seconds: number;
    agents_succeeded: number;
    agents_failed: number;
    note: string;
  };
}

// ─── File upload ──────────────────────────────────────────────────────────

export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
}
