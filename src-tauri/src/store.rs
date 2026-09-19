//! Append-only history of usage readings, one JSON object per line, in the app data dir.
//! Feeds the utilization-over-time chart. ~35 KB/day at a 5-minute poll interval.

use crate::usage::Usage;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};

const RETENTION_SECS: i64 = 90 * 24 * 3600;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Snapshot {
    /// Unix seconds
    pub ts: i64,
    pub five_hour: Option<f64>,
    pub seven_day: Option<f64>,
    pub seven_day_opus: Option<f64>,
    pub seven_day_sonnet: Option<f64>,
}

impl Snapshot {
    pub fn from_usage(ts: i64, u: &Usage) -> Self {
        let pct = |w: &Option<crate::usage::Window>| w.as_ref().map(|w| w.utilization);
        Snapshot {
            ts,
            five_hour: pct(&u.five_hour),
            seven_day: pct(&u.seven_day),
            seven_day_opus: pct(&u.seven_day_opus),
            seven_day_sonnet: pct(&u.seven_day_sonnet),
        }
    }
}

pub fn file_in(dir: &Path) -> PathBuf {
    dir.join("snapshots.jsonl")
}

pub fn append(file: &Path, snap: &Snapshot) -> std::io::Result<()> {
    if let Some(parent) = file.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut f = std::fs::OpenOptions::new().create(true).append(true).open(file)?;
    writeln!(f, "{}", serde_json::to_string(snap).map_err(std::io::Error::other)?)
}

pub fn read_since(file: &Path, since: i64) -> Vec<Snapshot> {
    let Ok(raw) = std::fs::read_to_string(file) else { return Vec::new() };
    raw.lines().filter_map(|l| serde_json::from_str::<Snapshot>(l).ok()).filter(|s| s.ts >= since).collect()
}

/// Drops readings older than the retention window. Called once at startup.
pub fn prune(file: &Path, now: i64) {
    let keep = read_since(file, now - RETENTION_SECS);
    let Ok(raw) = std::fs::read_to_string(file) else { return };
    if keep.len() == raw.lines().count() {
        return;
    }
    let body: String = keep.iter().filter_map(|s| serde_json::to_string(s).ok()).map(|l| l + "\n").collect();
    let _ = std::fs::write(file, body);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snap(ts: i64) -> Snapshot {
        Snapshot { ts, five_hour: Some(10.0), seven_day: Some(2.0), seven_day_opus: None, seven_day_sonnet: None }
    }

    #[test]
    fn append_read_prune_roundtrip() {
        let dir = std::env::temp_dir().join(format!("conto-test-{}", std::process::id()));
        let file = file_in(&dir);
        let now = 1_800_000_000;
        append(&file, &snap(now - RETENTION_SECS - 10)).unwrap();
        append(&file, &snap(now - 60)).unwrap();
        assert_eq!(read_since(&file, 0).len(), 2);
        prune(&file, now);
        let left = read_since(&file, 0);
        assert_eq!(left.len(), 1);
        assert_eq!(left[0].ts, now - 60);
        let _ = std::fs::remove_dir_all(dir);
    }
}
