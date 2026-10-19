export function taskPrompt(task) {
  return [
    `Task ID: ${task.id}\n${task.title}\n\n${task.prompt}`,
    `Required deliverables:\n${task.mandatory_deliverables.map(item => `- ${item}`).join('\n')}`,
    `Allowed public source files at immutable commits:\n${JSON.stringify(task.sources, null, 2)}`,
    'Use read_repository_file for ordinary text and inspect_repository_file for raw-byte hashes of large files. The latter returns metadata, not the file contents. inspect_release inspects the pinned release; inspect_release_asset is available only where explicitly allowed. Do not change source refs or assume unavailable tools exist.',
    `Return exactly one JSON object, not raw Markdown or fenced JSON, with exactly the fields task_id, report_markdown, conclusion and citations. task_id must equal ${JSON.stringify(task.id)}. Any request above for a final Markdown report means the report_markdown string inside this JSON object, never the outer answer format.`,
    'report_markdown must be nonempty Markdown containing at most 6000 UTF-8 bytes; aim for 4500-5000 bytes. conclusion must be a nonempty string and citations an array of strings. Cite exact observed source_url values (optional line anchors for source files). Describe unavailable evidence explicitly. Do not claim you ran shell tests, submitted comments, certified conformance, obtained protocol authorization or checked customer deployments. A report requires maintainer review before publication.',
  ].join('\n\n');
}

function blocked(reason) {
  return { status: 'blocked', reason, finalOutput: null, rounds: 0, tool_calls: 0, duration_ms: 0, trace: [],
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0, reported_requests: 0, missing_requests: 0 } };
}

export async function runScheduledTasks({ tasks, runOne, blockedLanes = [], sourceCheck = () => true }) {
  const rows = [];
  let stop;
  for (const task of tasks) {
    if (!stop && !sourceCheck()) stop = 'source_drift';
    let result;
    if (stop) result = blocked(stop);
    else if (blockedLanes.includes(task.lane)) result = blocked('lane_setup_blocked');
    else result = await runOne(task);
    rows.push({ id: task.id, lane: task.lane, result });
    if (['safety_stop', 'misalignment_enforcement'].includes(result.reason)) stop = 'study_stopped_after_safety_signal';
    if (result.reason === 'journal_error') stop = 'study_stopped_after_journal_error';
  }
  return rows;
}
