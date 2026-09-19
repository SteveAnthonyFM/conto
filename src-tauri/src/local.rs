//! Parses Claude Code's local session logs (`~/.claude/projects/**/*.jsonl`).
//! Used for token counts by model and history only. Never for percentages: plan limits
//! are unpublished, and logged `input_tokens` are streaming placeholders that undercount.

use chrono::DateTime;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

const HOUR: i64 = 3600;

#[derive(Serialize, Clone, Debug, Default, PartialEq)]
pub struct Bucket {
    /// Unix seconds, start of the hour (UTC)
    pub hour: i64,
    pub model: String,
    pub input: u64,
    pub output: u64,
    pub cache_creation: u64,
    pub cache_read: u64,
    pub requests: u64,
}

#[derive(Deserialize)]
struct Line {
    timestamp: Option<String>,
    #[serde(rename = "requestId")]
    request_id: Option<String>,
    message: Option<Message>,
}

#[derive(Deserialize)]
struct Message {
    id: Option<String>,
    model: Option<String>,
    usage: Option<RawUsage>,
}

#[derive(Deserialize, Default)]
struct RawUsage {
    #[serde(default)]
    input_tokens: u64,
    #[serde(default)]
    output_tokens: u64,
    #[serde(default)]
    cache_creation_input_tokens: u64,
    #[serde(default)]
    cache_read_input_tokens: u64,
}

pub fn project_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(dir) = std::env::var_os("CLAUDE_CONFIG_DIR") {
        // May be a comma-separated list, as Claude Code allows.
        for d in dir.to_string_lossy().split(',') {
            roots.push(PathBuf::from(d.trim()).join("projects"));
        }
    } else if let Some(home) = dirs::home_dir() {
        roots.push(home.join(".claude").join("projects"));
        roots.push(home.join(".config").join("claude").join("projects"));
    }
    roots.into_iter().filter(|p| p.is_dir()).collect()
}

fn jsonl_files(dir: &Path, modified_after: SystemTime, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(meta) = entry.metadata() else { continue };
        if meta.is_dir() {
            jsonl_files(&path, modified_after, out);
        } else if path.extension().is_some_and(|e| e == "jsonl") && meta.modified().is_ok_and(|m| m >= modified_after) {
            out.push(path);
        }
    }
}

/// Folds one log line into `buckets`. Returns without effect for lines with no usage,
/// synthetic messages, or messages already seen (Claude Code repeats messages across
/// resumed sessions; `message.id:requestId` is the dedupe key, as in ccusage).
fn ingest_line(raw: &str, since: i64, seen: &mut HashSet<String>, buckets: &mut HashMap<(i64, String), Bucket>) {
    if !raw.contains("\"usage\"") {
        return;
    }
    let Ok(line) = serde_json::from_str::<Line>(raw) else { return };
    let (Some(ts), Some(msg)) = (line.timestamp, line.message) else { return };
    let (Some(usage), Some(model)) = (msg.usage, msg.model) else { return };
    if model.starts_with('<') {
        return; // "<synthetic>"
    }
    let Ok(t) = DateTime::parse_from_rfc3339(&ts) else { return };
    let t = t.timestamp();
    if t < since {
        return;
    }
    if let (Some(m), Some(r)) = (&msg.id, &line.request_id) {
        if !seen.insert(format!("{m}:{r}")) {
            return;
        }
    }
    let hour = t - t.rem_euclid(HOUR);
    let b = buckets.entry((hour, model.clone())).or_insert_with(|| Bucket { hour, model, ..Default::default() });
    b.input += usage.input_tokens;
    b.output += usage.output_tokens;
    b.cache_creation += usage.cache_creation_input_tokens;
    b.cache_read += usage.cache_read_input_tokens;
    b.requests += 1;
}

/// Hourly per-model token buckets for everything at or after `since` (unix seconds).
pub fn scan(roots: &[PathBuf], since: i64) -> Vec<Bucket> {
    let modified_after = SystemTime::UNIX_EPOCH + Duration::from_secs(since.max(0) as u64);
    let mut files = Vec::new();
    for root in roots {
        jsonl_files(root, modified_after, &mut files);
    }
    let mut seen = HashSet::new();
    let mut buckets = HashMap::new();
    for file in files {
        let Ok(f) = std::fs::File::open(&file) else { continue };
        for line in BufReader::new(f).lines().map_while(Result::ok) {
            ingest_line(&line, since, &mut seen, &mut buckets);
        }
    }
    let mut out: Vec<Bucket> = buckets.into_values().collect();
    out.sort_by(|a, b| a.hour.cmp(&b.hour).then_with(|| a.model.cmp(&b.model)));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(id: &str, req: &str, ts: &str, model: &str, out: u64) -> String {
        format!(
            r#"{{"type":"assistant","timestamp":"{ts}","requestId":"{req}","message":{{"id":"{id}","model":"{model}","usage":{{"input_tokens":2,"output_tokens":{out},"cache_creation_input_tokens":10,"cache_read_input_tokens":100}}}}}}"#
        )
    }

    #[test]
    fn buckets_by_hour_and_model_and_dedupes() {
        let mut seen = HashSet::new();
        let mut b = HashMap::new();
        let a = line("m1", "r1", "2026-09-19T15:42:15.171Z", "claude-sonnet-5", 50);
        ingest_line(&a, 0, &mut seen, &mut b);
        ingest_line(&a, 0, &mut seen, &mut b); // duplicate from a resumed session
        ingest_line(&line("m2", "r2", "2026-09-19T15:59:00Z", "claude-sonnet-5", 30), 0, &mut seen, &mut b);
        ingest_line(&line("m3", "r3", "2026-09-19T16:01:00Z", "claude-opus-5", 5), 0, &mut seen, &mut b);
        ingest_line(&line("m4", "r4", "2026-09-19T16:02:00Z", "<synthetic>", 5), 0, &mut seen, &mut b);
        ingest_line(r#"{"type":"user","message":{"content":"hi"}}"#, 0, &mut seen, &mut b);

        assert_eq!(b.len(), 2);
        let sonnet = b.values().find(|x| x.model == "claude-sonnet-5").unwrap();
        assert_eq!((sonnet.requests, sonnet.output, sonnet.cache_read), (2, 80, 200));
        assert_eq!(sonnet.hour % 3600, 0);
    }

    #[test]
    fn respects_since() {
        let mut seen = HashSet::new();
        let mut b = HashMap::new();
        ingest_line(&line("m1", "r1", "2026-09-19T15:00:00Z", "claude-sonnet-5", 1), i64::MAX, &mut seen, &mut b);
        assert!(b.is_empty());
    }
}
