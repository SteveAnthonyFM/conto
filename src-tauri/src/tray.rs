//! The menu-bar / system-tray icon. Clicking it toggles the main window's visibility
//! (the "minimize to tray" affordance) rather than duplicating the compact card's own
//! controls — the tray's own menu only holds things that don't belong on the card:
//! Launch at Login and Quit.
//!
//! The card's own Close button hides the window instead of quitting the app (see
//! `run()`'s CloseRequested handler in lib.rs); this tray icon is what brings it back.

use crate::UsageReport;
use tauri::menu::{CheckMenuItem, CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

// macOS: black "template" image the menu bar recolors. Windows/Linux don't recolor tray icons,
// so they get a colored glyph that reads on both dark and light taskbars.
#[cfg(target_os = "macos")]
const ICON_BYTES: &[u8] = include_bytes!("../icons/tray-icon.png");
#[cfg(not(target_os = "macos"))]
const ICON_BYTES: &[u8] = include_bytes!("../icons/tray-icon-win.png");

fn toggle_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else { return };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn build(app: &AppHandle) -> tauri::Result<(TrayIcon, CheckMenuItem<tauri::Wry>)> {
    let launch_at_login_enabled = app.autolaunch().is_enabled().unwrap_or(false);
    let launch_at_login: CheckMenuItem<tauri::Wry> =
        CheckMenuItemBuilder::with_id("launch_at_login", "Launch at Login").checked(launch_at_login_enabled).build(app)?;
    let launch_for_menu = launch_at_login.clone();
    let quit = MenuItemBuilder::with_id("quit", "Quit CONTO").build(app)?;
    let menu = MenuBuilder::new(app).item(&launch_at_login).separator().item(&quit).build()?;

    let icon = tauri::image::Image::from_bytes(ICON_BYTES)?;

    let tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .icon_as_template(cfg!(target_os = "macos")) // macOS: adapts to light/dark menu bar automatically
        .tooltip("CONTO")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "quit" => app.exit(0),
            "launch_at_login" => {
                let mgr = app.autolaunch();
                let now_enabled = mgr.is_enabled().unwrap_or(false);
                let result = if now_enabled { mgr.disable() } else { mgr.enable() };
                if result.is_err() {
                    return;
                }
                let _ = launch_for_menu.set_checked(!now_enabled);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                toggle_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok((tray, launch_at_login))
}

/// Reflects the latest usage in the tray: a percentage next to the icon on macOS (there's
/// no room for text on Windows/Linux tray icons, so they only get the tooltip), plus a
/// fuller breakdown in the hover tooltip on every platform.
pub fn update(tray: &TrayIcon, report: &UsageReport) {
    let Some(usage) = &report.usage else { return };
    let five_hour = usage.five_hour.as_ref().map(|w| w.utilization.round() as i64);

    #[cfg(target_os = "macos")]
    {
        let title = five_hour.map(|p| format!("{p}%"));
        let _ = tray.set_title(title);
    }

    let mut lines = vec!["CONTO".to_string()];
    if let Some(p) = five_hour {
        lines.push(format!("Session: {p}%"));
    }
    if let Some(w) = &usage.seven_day {
        lines.push(format!("Weekly: {}%", w.utilization.round() as i64));
    }
    let _ = tray.set_tooltip(Some(lines.join("\n")));
}
