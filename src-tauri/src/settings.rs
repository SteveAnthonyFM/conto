//! Small persisted app preferences. Window position and
//! size are handled separately by `tauri-plugin-window-state`; autostart's on/off state
//! lives with the OS itself (queried live via `tauri-plugin-autostart`), not duplicated
//! here. This file is the seed for Milestone 6's fuller settings (plan tier, thresholds,
//! notifications, poll interval).

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default)]
pub struct Settings {
    pub always_on_top: bool,
    /// Desktop notifications when a gauge crosses a threshold.
    pub notifications_enabled: bool,
    /// Gauge turns amber / notifies at this % (default 60).
    pub warn_pct: u8,
    /// Gauge turns red / notifies at this % (default 85).
    pub limit_pct: u8,
    /// How often CONTO re-reads usage, in minutes.
    pub poll_minutes: u32,
}

impl Settings {
    /// Keeps hand-edited or out-of-range values sane: 1 <= warn < limit <= 100, poll 1..=60.
    pub fn clamped(mut self) -> Self {
        self.limit_pct = self.limit_pct.clamp(2, 100);
        self.warn_pct = self.warn_pct.clamp(1, self.limit_pct - 1);
        self.poll_minutes = self.poll_minutes.clamp(1, 60);
        self
    }

    /// Applies a partial update (only known keys) over these settings.
    pub fn patched(&self, patch: &serde_json::Value) -> Self {
        let mut v = serde_json::to_value(self).unwrap_or_default();
        if let (Some(base), Some(p)) = (v.as_object_mut(), patch.as_object()) {
            for (k, val) in p {
                if base.contains_key(k) {
                    base.insert(k.clone(), val.clone());
                }
            }
        }
        serde_json::from_value::<Settings>(v).unwrap_or_else(|_| self.clone()).clamped()
    }
}

impl Default for Settings {
    fn default() -> Self {
        Settings { always_on_top: false, notifications_enabled: true, warn_pct: 60, limit_pct: 85, poll_minutes: 5 }
    }
}

pub fn file_in(dir: &Path) -> PathBuf {
    dir.join("settings.json")
}

pub fn load(file: &Path) -> Settings {
    std::fs::read_to_string(file).ok().and_then(|raw| serde_json::from_str(&raw).ok()).unwrap_or_default()
}

pub fn save(file: &Path, settings: &Settings) -> std::io::Result<()> {
    if let Some(parent) = file.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let body = serde_json::to_string_pretty(settings).map_err(std::io::Error::other)?;
    std::fs::write(file, body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_file_is_default() {
        let dir = std::env::temp_dir().join(format!("conto-settings-test-missing-{}", std::process::id()));
        assert_eq!(load(&file_in(&dir)), Settings::default());
    }

    #[test]
    fn save_then_load_roundtrips() {
        let dir = std::env::temp_dir().join(format!("conto-settings-test-{}", std::process::id()));
        let file = file_in(&dir);
        let s = Settings { always_on_top: true, ..Settings::default() };
        save(&file, &s).unwrap();
        assert_eq!(load(&file), s);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn patch_applies_known_keys_and_clamps() {
        let s = Settings::default().patched(&serde_json::json!({"warn_pct": 90, "limit_pct": 80, "bogus": 1, "poll_minutes": 0}));
        assert_eq!(s.limit_pct, 80);
        assert_eq!(s.warn_pct, 79);
        assert_eq!(s.poll_minutes, 1);
    }

    #[test]
    fn bad_patch_type_keeps_previous() {
        let s = Settings::default().patched(&serde_json::json!({"warn_pct": "high"}));
        assert_eq!(s, Settings::default());
    }
}
