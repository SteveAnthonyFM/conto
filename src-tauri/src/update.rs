//! "Is there a newer CONTO?" — asks GitHub for the latest published release and compares its
//! version with the running one. Notify-only: CONTO never downloads or installs anything; it
//! just opens the release page. Only the public releases API is contacted, and nothing about
//! the user is sent.

use serde::Serialize;
use std::time::Duration;

const RELEASES_API: &str = "https://api.github.com/repos/SteveAnthonyFM/conto/releases/latest";
/// The only pages CONTO will open on the user's behalf.
const RELEASES_PAGE_PREFIX: &str = "https://github.com/SteveAnthonyFM/conto/";
const FALLBACK_PAGE: &str = "https://github.com/SteveAnthonyFM/conto/releases/latest";

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct UpdateInfo {
    /// Version of the running app.
    pub current: String,
    /// Newest published version, e.g. "0.2.0".
    pub latest: String,
    pub available: bool,
    /// Release page to open.
    pub url: String,
}

/// "v0.2.0" / "0.2.0-beta.1" -> (0, 2, 0). Pre-release suffixes are ignored.
fn parse_version(v: &str) -> Option<(u64, u64, u64)> {
    let core = v.trim().trim_start_matches(['v', 'V']).split(['-', '+']).next()?;
    let mut parts = core.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next().unwrap_or("0").parse().ok()?;
    let patch = parts.next().unwrap_or("0").parse().ok()?;
    parts.next().is_none().then_some((major, minor, patch))
}

pub fn is_newer(latest: &str, current: &str) -> bool {
    matches!((parse_version(latest), parse_version(current)), (Some(l), Some(c)) if l > c)
}

fn info_from_release(body: &str, current: &str) -> Result<UpdateInfo, String> {
    let v: serde_json::Value = serde_json::from_str(body).map_err(|e| format!("unexpected response: {e}"))?;
    let tag = v.get("tag_name").and_then(|t| t.as_str()).ok_or("no release found")?;
    let latest = tag.trim_start_matches(['v', 'V']).to_string();
    parse_version(&latest).ok_or_else(|| format!("unrecognized version \"{tag}\""))?;
    let url = v
        .get("html_url")
        .and_then(|u| u.as_str())
        .filter(|u| u.starts_with(RELEASES_PAGE_PREFIX))
        .unwrap_or(FALLBACK_PAGE)
        .to_string();
    Ok(UpdateInfo { current: current.to_string(), available: is_newer(&latest, current), latest, url })
}

/// Blocking network call — run on a worker thread.
pub fn check(current: &str) -> Result<UpdateInfo, String> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .timeout_global(Some(Duration::from_secs(15)))
        .build()
        .into();
    let mut resp = agent
        .get(RELEASES_API)
        .header("User-Agent", format!("CONTO/{current}"))
        .header("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| format!("couldn't reach GitHub ({e})"))?;
    match resp.status().as_u16() {
        200 => {}
        404 => return Err("no published release yet".into()),
        403 | 429 => return Err("GitHub is rate limiting update checks — try again later".into()),
        s => return Err(format!("GitHub returned HTTP {s}")),
    }
    let body = resp.body_mut().read_to_string().map_err(|e| e.to_string())?;
    info_from_release(&body, current)
}

/// Opens `url` in the default browser — but only a CONTO page on GitHub.
pub fn open_release_page(url: &str) -> Result<(), String> {
    if !url.starts_with(RELEASES_PAGE_PREFIX) || !url.chars().all(|c| c.is_ascii_graphic()) {
        return Err("refusing to open an unexpected address".into());
    }
    use std::process::Command;
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = Command::new("rundll32");
        c.args(["url.dll,FileProtocolHandler", url]);
        c
    };
    #[cfg(target_os = "macos")]
    let mut cmd = {
        let mut c = Command::new("open");
        c.arg(url);
        c
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut cmd = {
        let mut c = Command::new("xdg-open");
        c.arg(url);
        c
    };
    cmd.spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_versions_numerically() {
        assert!(is_newer("0.2.0", "0.1.3"));
        assert!(is_newer("v0.10.0", "0.9.9"));
        assert!(is_newer("1.0.0", "0.99.99"));
        assert!(!is_newer("0.1.3", "0.1.3"));
        assert!(!is_newer("0.1.2", "0.1.3"));
        assert!(!is_newer("garbage", "0.1.3"));
    }

    #[test]
    fn ignores_prerelease_suffix() {
        assert_eq!(parse_version("v0.2.0-beta.1"), Some((0, 2, 0)));
        assert_eq!(parse_version("0.2"), Some((0, 2, 0)));
        assert_eq!(parse_version("1.2.3.4"), None);
    }

    #[test]
    fn reads_a_github_release() {
        let body = r#"{"tag_name":"v0.2.0","html_url":"https://github.com/SteveAnthonyFM/conto/releases/tag/v0.2.0"}"#;
        let i = info_from_release(body, "0.1.3").unwrap();
        assert!(i.available);
        assert_eq!(i.latest, "0.2.0");
        assert!(i.url.ends_with("v0.2.0"));
        assert!(!info_from_release(body, "0.2.0").unwrap().available);
    }

    #[test]
    fn foreign_release_url_falls_back_to_ours() {
        let body = r#"{"tag_name":"v0.2.0","html_url":"https://evil.example/x"}"#;
        assert_eq!(info_from_release(body, "0.1.3").unwrap().url, FALLBACK_PAGE);
    }

    #[test]
    fn refuses_to_open_other_sites() {
        assert!(open_release_page("https://evil.example/").is_err());
        assert!(open_release_page("https://github.com/SteveAnthonyFM/conto/ x").is_err());
    }
}
