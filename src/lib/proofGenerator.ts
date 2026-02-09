import type { Task } from '../types/supabase';
import type { MissionProofReport } from './missionProof';

export interface ProofGeneratorOptions {
  gitRoot?: string;
}

function missionLooksLikeImplementationWork(task: Task): boolean {
  const text = [
    task.title || '',
    task.description || '',
    task.input_text || '',
  ]
    .join(' ')
    .toLowerCase();

  if (/\bnon[-\s]?code\b/.test(text) || /\bno[-\s]?code\b/.test(text)) {
    return false;
  }

  const analysisOnlyHints = [
    'plan only',
    'proposal',
    'propose',
    'draft plan',
    'analysis only',
    'spec only',
    'brainstorm',
    'outline',
    'research',
    'investigate',
    'explore',
  ];
  if (analysisOnlyHints.some((hint) => text.includes(hint))) {
    return false;
  }

  const implementationPatterns = [
    /\bimplement\b/,
    /\bbuild\b/,
    /\bcreate\b/,
    /\bupdate\b/,
    /\brefactor\b/,
    /\bfix\b/,
    /\bcode\b/,
    /\bfrontend\b/,
    /\bbackend\b/,
    /\bcomponent\b/,
    /\bhook\b/,
    /\bmigration\b/,
    /\bschema\b/,
    /\bsupabase\b/,
    /\bapi\b/,
    /\bwire\b/,
    /\bintegration\b/,
    /\btypescript\b/,
    /\breact\b/,
    /\bui\b/,
    /\bmission control\b/,
    /\bdatabase\b/,
    /\bfeature\b/,
  ];

  return implementationPatterns.some((pattern) => pattern.test(text));
}

async function captureGitChanges(): Promise<MissionProofReport['changed_files']> {
  try {
    // Use Tauri's shell plugin to run git status
    const { Command } = await import('@tauri-apps/plugin-shell');

    const result = await Command.create('git', ['status', '--porcelain']).execute();

    if (result.code !== 0) {
      console.error('[ProofGenerator] Git command failed:', result.stderr);
      return [];
    }

    const stdout = result.stdout;
    const lines = stdout.trim().split('\n').filter(Boolean);
    const files = lines.map((line) => {
      const statusCode = line.substring(0, 2).trim();
      const path = line.substring(3).trim();

      let status = 'modified';
      if (statusCode === 'A' || statusCode === '??') status = 'created';
      else if (statusCode === 'D') status = 'deleted';
      else if (statusCode === 'M') status = 'modified';
      else if (statusCode === 'R') status = 'renamed';

      return { path, status };
    });

    return files;
  } catch (error) {
    console.error('[ProofGenerator] Failed to capture git changes:', error);
    return [];
  }
}

function extractVerificationSteps(outputText: string): string[] {
  const steps: string[] = [];

  // Look for checkmarks or bullet points
  const checkmarkPattern = /^[\s-]*[✓✔✅☑]\s*(.+)$/gm;
  const matches = outputText.matchAll(checkmarkPattern);
  for (const match of matches) {
    if (match[1]) steps.push(match[1].trim());
  }

  // If no checkmarks found, look for numbered lists
  if (steps.length === 0) {
    const numberedPattern = /^\s*\d+\.\s+(.+)$/gm;
    const numberedMatches = outputText.matchAll(numberedPattern);
    for (const match of numberedMatches) {
      if (match[1]) steps.push(match[1].trim());
    }
  }

  // If still nothing, look for bullet points
  if (steps.length === 0) {
    const bulletPattern = /^[\s-]*[•\-\*]\s+(.+)$/gm;
    const bulletMatches = outputText.matchAll(bulletPattern);
    for (const match of bulletMatches) {
      if (match[1]) steps.push(match[1].trim());
    }
  }

  // Limit to first 5 steps to keep it concise
  return steps.slice(0, 5);
}

function generateSummary(task: Task, outputText: string): string {
  // Try to extract first sentence or paragraph as summary
  const firstParagraph = outputText.split('\n\n')[0]?.trim();
  if (firstParagraph && firstParagraph.length < 200) {
    return firstParagraph;
  }

  // Fallback to task title-based summary
  return `Completed: ${task.title}`;
}

export async function generateProofReport(
  task: Task,
  outputText: string,
  options: ProofGeneratorOptions = {}
): Promise<string> {
  const isImplementation = missionLooksLikeImplementationWork(task);

  if (isImplementation) {
    // Implementation/coding mission - capture git changes
    const changedFiles = await captureGitChanges();
    const verification = extractVerificationSteps(outputText);
    const summary = generateSummary(task, outputText);

    const report: MissionProofReport = {
      result: changedFiles.length > 0 ? 'implemented' : 'analysis_only',
      repo_root: options.gitRoot || null,
      changed_files: changedFiles,
      verification: verification.length > 0
        ? verification
        : changedFiles.length > 0
        ? [`✅ Modified ${changedFiles.length} file(s)`]
        : ['✅ Analysis completed'],
      summary,
    };

    return `\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``;
  } else {
    // Non-implementation mission - generate completion proof
    const verification = extractVerificationSteps(outputText);
    const summary = generateSummary(task, outputText);

    const report: MissionProofReport = {
      result: 'completed',
      repo_root: null,
      changed_files: [],
      verification: verification.length > 0
        ? verification
        : ['✅ Task completed as requested'],
      summary,
    };

    return `\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``;
  }
}

export function appendProofToOutput(outputText: string, proofReport: string): string {
  // Check if proof already exists
  if (outputText.includes('```json') && outputText.includes('"result"')) {
    // Already has a proof report
    return outputText;
  }

  return outputText + proofReport;
}
