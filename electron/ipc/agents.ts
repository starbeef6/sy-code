import fs from 'fs';
import { AGENT_CATALOG } from '../agents/catalog.js';
import { findExecutableOnPath } from '../env/resolver.js';

export interface AgentDef {
  id: string;
  name: string;
  command: string;
  description: string;
  available?: boolean;
}

function isExecutable(candidate: string): boolean {
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function isAgentAvailable(preferredBinary: string, bareName: string): boolean {
  if (isExecutable(preferredBinary)) return true;
  return findExecutableOnPath(bareName, process.env.PATH ?? '') !== null;
}

export function listAgents(): AgentDef[] {
  return AGENT_CATALOG.map((entry) => ({
    id: entry.id,
    name: entry.name,
    command: entry.bareName,
    description: `${entry.name} (non-interactive)`,
    available: isAgentAvailable(entry.preferredBinary, entry.bareName),
  }));
}
