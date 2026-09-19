//! Reads the OAuth token Claude Code stores locally. CONTO never writes or refreshes it —
//! Claude Code renews it while in use. The token is never logged (no `Debug` on `Token`).

use serde::Deserialize;
use std::path::PathBuf;

pub struct Token {
    pub access_token: String,
    pub expires_at_ms: Option<i64>,
    pub subscription_type: Option<String>,
}

#[derive(Debug)]
pub enum CredError {
    NotFound,
    Unreadable(String),
}

#[derive(Deserialize)]
struct CredFile {
    #[serde(rename = "claudeAiOauth")]
    oauth: Option<OAuth>,
}

#[derive(Deserialize)]
struct OAuth {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "expiresAt")]
    expires_at: Option<i64>,
    #[serde(rename = "subscriptionType")]
    subscription_type: Option<String>,
}

pub fn parse_credentials(json: &str) -> Result<Token, CredError> {
    let file: CredFile = serde_json::from_str(json).map_err(|_| CredError::Unreadable("unrecognized credentials format".into()))?;
    let oauth = file.oauth.ok_or(CredError::NotFound)?;
    Ok(Token {
        access_token: oauth.access_token,
        expires_at_ms: oauth.expires_at,
        subscription_type: oauth.subscription_type,
    })
}

fn credentials_file() -> Option<PathBuf> {
    let base = std::env::var_os("CLAUDE_CONFIG_DIR")
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|h| h.join(".claude")))?;
    Some(base.join(".credentials.json"))
}

#[cfg(target_os = "macos")]
fn read_keychain() -> Option<String> {
    use std::process::{Command, Stdio};
    // Same approach as other Claude usage tools: ask the `security` CLI so the user
    // sees a normal Keychain prompt (and can choose "Always Allow").
    let out = Command::new("security")
        .args(["find-generic-password", "-s", "Claude Code-credentials", "-w"])
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    String::from_utf8(out.stdout).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

#[cfg(not(target_os = "macos"))]
fn read_keychain() -> Option<String> {
    None
}

pub fn read_token() -> Result<Token, CredError> {
    if let Some(raw) = read_keychain() {
        return parse_credentials(&raw);
    }
    let path = credentials_file().ok_or(CredError::NotFound)?;
    match std::fs::read_to_string(&path) {
        Ok(raw) => parse_credentials(&raw),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Err(CredError::NotFound),
        Err(e) => Err(CredError::Unreadable(e.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_claude_code_credentials() {
        let json = r#"{"claudeAiOauth":{"accessToken":"tok","refreshToken":"r","expiresAt":1790000000000,"scopes":["a"],"subscriptionType":"pro"}}"#;
        let t = parse_credentials(json).unwrap();
        assert_eq!(t.access_token, "tok");
        assert_eq!(t.expires_at_ms, Some(1790000000000));
        assert_eq!(t.subscription_type.as_deref(), Some("pro"));
    }

    #[test]
    fn missing_oauth_block_is_not_found() {
        assert!(matches!(parse_credentials("{}"), Err(CredError::NotFound)));
    }
}
