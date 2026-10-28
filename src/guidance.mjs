import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NexusError } from './errors.mjs';

export const MASTER_URI = 'unreal-nexus://guidance/master';
export const ENABLED_GUIDANCE_URI = 'unreal-nexus://guidance/enabled';
export const CATALOG_URI = 'unreal-nexus://catalog/enabled';
export const STATUS_URI = 'unreal-nexus://runtime/status';

const sectionsByDecision = {
  'pie-lifecycle':[2], 'editor-screenshot':[3], 'pie-screenshot':[3],
  'actor-inspection':[4], 'level-save':[5], 'asset-save':[5],
  'pcg-connection':[6], 'pcg-generation':[7], 'enhanced-input':[8],
  'blueprint-compile-memory':[9], 'material-parameter-strict':[10],
  'automation-tests':[11], 'trace-analysis':[12],
};

export async function loadGuidance() {
  const master = await readFile(new URL('../docs/MASTER_SKILL_GUIDANCE_DRAFT.md', import.meta.url), 'utf8');
  return parseGuidance(master);
}

export function parseGuidance(master) {
  const sections = new Map();
  const headings = [...master.matchAll(/^## (\d+)\. .+$/gm)];
  for (let i = 0; i < headings.length; i++) {
    const number = Number(headings[i][1]);
    if (sections.has(number)) throw new Error('Duplicate master guidance section ' + number);
    sections.set(number, master.slice(headings[i].index, headings[i + 1]?.index ?? master.length).trim());
  }
  for (let i = 0; i <= 16; i++) if (!sections.has(i)) throw new Error('Missing master guidance section ' + i);
  return {
    master, sections, sha256:createHash('sha256').update(master).digest('hex'),
    forOperations(operations) {
      const selected = new Set([0,1,16]);
      for (const op of operations) {
        const workflow = op.guidanceSections ?? sectionsByDecision[op.decision];
        if (!workflow) throw new NexusError('GUIDANCE_UNMAPPED', 'No workflow guidance for ' + op.id);
        for (const number of workflow) {
          if (!sections.has(number)) throw new Error('Unknown guidance section ' + number);
          selected.add(number);
        }
      }
      return [...selected].sort((a,b) => a-b).map(n => sections.get(n)).join('\n\n') + '\n';
    },
  };
}
