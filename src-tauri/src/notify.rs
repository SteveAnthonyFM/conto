//! Threshold notifications. Each usage window (session, weekly) has a level — 0 normal,
//! 1 at/over the warn %, 2 at/over the limit % — and we notify only when the level goes
//! UP. The first reading after launch just records the level silently, so reopening the app
//! at 70% doesn't fire a notification for something you already knew.

use crate::settings::Settings;
use crate::usage::{Usage, Window};
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

#[derive(Default)]
pub struct Levels {
    session: Option<u8>,
    weekly: Option<u8>,
}

pub fn level(pct: f64, s: &Settings) -> u8 {
    if pct >= f64::from(s.limit_pct) {
        2
    } else if pct >= f64::from(s.warn_pct) {
        1
    } else {
        0
    }
}

/// Returns Some(new_level) when a notification is due, and updates `slot`.
fn step(slot: &mut Option<u8>, pct: f64, s: &Settings) -> Option<u8> {
    let now = level(pct, s);
    let fire = matches!(*slot, Some(prev) if now > prev).then_some(now);
    *slot = Some(now);
    fire
}

fn resets_in(w: &Window) -> Option<String> {
    let at = chrono::DateTime::parse_from_rfc3339(w.resets_at.as_deref()?).ok()?;
    let mins = (at.with_timezone(&chrono::Utc) - chrono::Utc::now()).num_minutes();
    if mins <= 0 {
        return None;
    }
    Some(if mins >= 24 * 60 {
        format!("Resets in {}d {}h", mins / (24 * 60), (mins % (24 * 60)) / 60)
    } else {
        format!("Resets in {}h {}m", mins / 60, mins % 60)
    })
}

fn send(app: &AppHandle, name: &str, w: &Window, lvl: u8) {
    let pct = w.utilization.round() as i64;
    let title = if lvl >= 2 { format!("{name} usage at {pct}% — near your limit") } else { format!("{name} usage at {pct}%") };
    let body = resets_in(w).unwrap_or_else(|| "Keep an eye on your usage.".to_string());
    let _ = app.notification().builder().title(title).body(body).show();
}

pub fn check(app: &AppHandle, levels: &mut Levels, usage: &Usage, s: &Settings) {
    let session = usage.five_hour.as_ref().and_then(|w| step(&mut levels.session, w.utilization, s).map(|l| (w, l)));
    let weekly = usage.seven_day.as_ref().and_then(|w| step(&mut levels.weekly, w.utilization, s).map(|l| (w, l)));
    if !s.notifications_enabled {
        return;
    }
    if let Some((w, l)) = session {
        send(app, "Session", w, l);
    }
    if let Some((w, l)) = weekly {
        send(app, "Weekly", w, l);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_reading_is_silent_then_only_increases_fire() {
        let s = Settings::default();
        let mut slot = None;
        assert_eq!(step(&mut slot, 70.0, &s), None); // first reading: record only
        assert_eq!(step(&mut slot, 72.0, &s), None); // same level
        assert_eq!(step(&mut slot, 90.0, &s), Some(2)); // crossed limit
        assert_eq!(step(&mut slot, 10.0, &s), None); // reset drops level silently
        assert_eq!(step(&mut slot, 61.0, &s), Some(1)); // crosses warn again
    }
}
