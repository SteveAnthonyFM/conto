//! Small persisted app preferences — currently just `always_on_top`. Window position and
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
    /// Whether the History panel was open at last change. The window-state plugin saves the
    /// window's full height (panel included) but the panel always starts closed, so on
    /// launch the frontend uses this to shrink the window back to its compact size.
    pub history_open: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings { always_on_top: false, history_open: false }
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
        let s = Settings { always_on_top: true, history_open: true };
        save(&file, &s).unwrap();
        assert_eq!(load(&file), s);
        let _ = std::fs::remove_dir_all(dir);
    }
}
