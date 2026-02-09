# Mission Proof System

## Overview

The Mission Proof System automatically generates and validates proof that missions were completed correctly. It intelligently detects mission types and generates appropriate proof reports.

## How It Works

### Automatic Proof Generation

When a mission completes, the system:

1. **Detects Mission Type** - Analyzes the mission title, description, and instructions to classify it as:
   - **Implementation/Coding** - Contains keywords like: implement, build, fix, refactor, code, component, API, etc.
   - **Analysis/Planning** - Contains keywords like: plan only, analysis only, proposal, research, investigate, etc.
   - **Non-Code Tasks** - Explicitly marked as "non-code" or "no-code"

2. **Generates Proof Based on Type**:

   **For Implementation Tasks:**
   ```json
   {
     "result": "implemented",
     "repo_root": "/path/to/repo",
     "changed_files": [
       {"path": "src/components/Example.tsx", "status": "modified"},
       {"path": "src/lib/utility.ts", "status": "created"}
     ],
     "verification": [
       "✅ Created mission control UI components",
       "✅ Wired up Supabase integration"
     ],
     "summary": "Implemented complete mission control system"
   }
   ```

   **For Analysis/Planning Tasks:**
   ```json
   {
     "result": "analysis_only",
     "verification": [
       "✅ Researched 5 competitor solutions",
       "✅ Created decision matrix"
     ],
     "summary": "Completed market analysis and recommendations"
   }
   ```

   **For Non-Code Tasks:**
   ```json
   {
     "result": "completed",
     "verification": [
       "✅ Drafted email to stakeholders",
       "✅ Updated project timeline"
     ],
     "summary": "Communication tasks completed"
   }
   ```

3. **Appends Proof** - The proof JSON is automatically appended to the mission's `output_text` in a code fence.

### Proof Validation

The system validates proof reports and shows status badges:

- ✅ **Proof Verified** - Implementation task with changed files captured
- ℹ️ **Proof N/A** - Analysis/planning task, proof not required
- ⚠️ **Proof Missing** - Implementation task but no proof found
- ❌ **Proof Invalid** - Proof exists but incomplete/malformed

## Retroactive Proof for Existing Missions

For missions that completed before the proof system was implemented, you can add proof retroactively.

### Using Dev Console

1. Open your browser's Developer Console (F12 or Cmd+Option+I)

2. List all missions to find IDs:
   ```javascript
   window.agoraDevUtils.getMissions()
   ```

3. Add proof to a specific mission:
   ```javascript
   await window.agoraDevUtils.addRetroactiveProof('mission-id-here')
   ```

4. Or add proof to ALL completed missions at once:
   ```javascript
   await window.agoraDevUtils.addRetroactiveProofToAll()
   ```

### Example Session

```javascript
// 1. Get all missions and find completed ones
const missions = window.agoraDevUtils.getMissions()
const completed = missions.filter(m => m.status === 'done')
console.log('Completed missions:', completed.map(m => ({ id: m.id, title: m.title })))

// 2. Add proof to specific missions (use the IDs from step 1)
await window.agoraDevUtils.addRetroactiveProof('abc-123')
await window.agoraDevUtils.addRetroactiveProof('def-456')

// 3. Or add to all at once
const result = await window.agoraDevUtils.addRetroactiveProofToAll()
console.log(`Success: ${result.success}, Failed: ${result.failed}`)
```

## Technical Details

### Files

- **src/lib/proofGenerator.ts** - Core proof generation logic
- **src/lib/missionProof.ts** - Proof parsing and validation
- **src/lib/retroactiveProof.ts** - Utilities for adding proof to existing missions
- **src/hooks/useMissionScheduler.ts** - Integration point where proof is generated on completion

### Git Integration

For implementation tasks, the system uses Tauri's shell plugin to run:
```bash
git status --porcelain
```

This captures:
- Modified files (M)
- Created files (A, ??)
- Deleted files (D)
- Renamed files (R)

### Verification Steps

The proof generator automatically extracts verification steps from mission output by looking for:
- Checkmarks: `✅ ✓ ✔ ☑`
- Numbered lists: `1. 2. 3.`
- Bullet points: `• - *`

It uses the first 5 steps found to keep proof concise.

## Troubleshooting

### Proof Shows as "Missing" After Completion

**Possible causes:**
1. Mission completed before proof system was implemented → Use retroactive proof utility
2. Git command failed → Check console for errors
3. Mission type detection failed → Manually mark as non-code if appropriate

### Proof Shows as "Invalid"

**Possible causes:**
1. JSON proof is malformed
2. Implementation task but `changed_files` array is empty
3. Result field has unexpected value

Check the mission's `output_text` in the database to see the actual proof JSON.

### Git Changes Not Captured

**Requirements:**
- Repository must be a git repository
- Must have uncommitted changes when mission completes
- Tauri shell plugin must have permission to run git commands

If git commands fail, proof will still be generated but `changed_files` will be empty.

## Future Enhancements

Potential improvements:
- Screenshot capture for UI tasks
- Test result integration
- Deployment verification
- Performance metrics capture
- Code coverage reports
- Linting/formatting validation
