export type AgentName = 'token' | 'wallet' | 'risk' | 'research';

export type AgentCheck = {
  label: string;
  value: string | number;
  note?: string;
};

export type AgentBrief = {
  name: AgentName;
  title: string;
  score: number;
  checks: AgentCheck[];
  findings: string[];
};

export type OrchestratorResult = {
  graph: string[][];
  agents: {
    token: AgentBrief;
    wallet: AgentBrief;
    risk: AgentBrief;
    research: AgentBrief;
  };
  generatedAt: string;
};
