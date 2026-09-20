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
    /// Sign-in expiry reminder stage: 0 none, 1 within 3 days, 2 within 1 day.
    expiry: u8,
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

const DAY_SECS: i64 = 24 * 60 * 60;

/// 0 = plenty of time (or unknown), 1 = within 3 days, 2 = within 1 day (or already past).
pub fn expiry_level(expires_at: Option<i64>, now: i64) -> u8 {
    match expires_at.map(|t| t - now) {
        Some(left) if left <= DAY_SECS => 2,
        Some(left) if left <= 3 * DAY_SECS => 1,
        _ => 0,
    }
}

/// Returns Some(new_level) when a reminder is due. Unlike usage levels, the first reading
/// counts: opening the app with 2 days left should tell you. Signing in again pushes the
/// expiry out, dropping the level back to 0 so a later expiry can remind again.
fn expiry_step(slot: &mut u8, expires_at: Option<i64>, now: i64) -> Option<u8> {
    let lvl = expiry_level(expires_at, now);
    let fire = (lvl > *slot).then_some(lvl);
    *slot = lvl;
    fire
}

pub fn check_session_expiry(app: &AppHandle, levels: &mut Levels, expires_at: Option<i64>, now: i64, s: &Settings) {
    let Some(lvl) = expiry_step(&mut levels.expiry, expires_at, now) else { return };
    if !s.notifications_enabled {
        return;
    }
    let left = expires_at.map_or(0, |t| t - now);
    let title = if left <= 0 {
        "Your Claude sign-in has expired".to_string()
    } else if lvl >= 2 {
        "Your Claude sign-in expires within a day".to_string()
    } else {
        format!("Your Claude sign-in expires in {} days", (left + DAY_SECS - 1) / DAY_SECS)
    };
    let _ = app.notification().builder().title(title).body("Open CONTO and choose Sign in to keep your usage updating.").show();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expiry_reminders_fire_at_three_days_then_one_day() {
        let now = 1_000_000;
        let mut slot = 0;
        assert_eq!(expiry_step(&mut slot, None, now), None); // no cookie expiry known
        assert_eq!(expiry_step(&mut slot, Some(now + 10 * DAY_SECS), now), None);
        assert_eq!(expiry_step(&mut slot, Some(now + 2 * DAY_SECS), now), Some(1));
        assert_eq!(expiry_step(&mut slot, Some(now + 2 * DAY_SECS), now), None); // already told
        assert_eq!(expiry_step(&mut slot, Some(now + DAY_SECS / 2), now), Some(2));
        assert_eq!(expiry_step(&mut slot, Some(now + 28 * DAY_SECS), now), None); // signed in again
        assert_eq!(expiry_step(&mut slot, Some(now + 3 * DAY_SECS), now), Some(1)); // and can remind again
    }

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
