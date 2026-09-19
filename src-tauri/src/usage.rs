//! Client for Anthropic's (unofficial) usage endpoint. Read-only, `api.anthropic.com` only.
//! The endpoint may change without notice; everything that touches it lives in this file.

use serde::{Deserialize, Serialize};
use std::time::Duration;

const URL: &str = "https://api.anthropic.com/api/oauth/usage";
// Without a `claude-code/` User-Agent this endpoint puts callers in an aggressive
// rate-limit bucket. The version is cosmetic; bump it if requests start failing.
const USER_AGENT: &str = "claude-code/2.1.0";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Window {
    /// 0–100
    pub utilization: f64,
    /// ISO 8601 UTC
    pub resets_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct Usage {
    pub five_hour: Option<Window>,
    pub seven_day: Option<Window>,
    pub seven_day_opus: Option<Window>,
    pub seven_day_sonnet: Option<Window>,
    pub extra_usage: Option<serde_json::Value>,
}

#[derive(Debug)]
pub enum FetchError {
    Unauthorized,
    RateLimited { retry_after_secs: u64 },
    Network(String),
    BadResponse(String),
}

pub fn parse_usage(body: &str) -> Result<Usage, FetchError> {
    serde_json::from_str(body).map_err(|e| FetchError::BadResponse(e.to_string()))
}

pub fn fetch_usage(access_token: &str) -> Result<Usage, FetchError> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .timeout_global(Some(Duration::from_secs(20)))
        .build()
        .into();

    let mut resp = agent
        .get(URL)
        .header("Authorization", &format!("Bearer {access_token}"))
        .header("anthropic-beta", "oauth-2025-04-20")
        .header("User-Agent", USER_AGENT)
        .header("Content-Type", "application/json")
        .call()
        .map_err(|e| FetchError::Network(e.to_string()))?;

    match resp.status().as_u16() {
        200 => {
            let body = resp.body_mut().read_to_string().map_err(|e| FetchError::Network(e.to_string()))?;
            parse_usage(&body)
        }
        401 | 403 => Err(FetchError::Unauthorized),
        429 => {
            let retry_after_secs = resp
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse().ok())
                .unwrap_or(300);
            Err(FetchError::RateLimited { retry_after_secs })
        }
        s => Err(FetchError::BadResponse(format!("HTTP {s}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_documented_shape() {
        let body = r#"{"five_hour":{"utilization":91,"resets_at":"2026-09-19T20:00:00Z"},
            "seven_day":{"utilization":25.5,"resets_at":"2026-09-24T09:00:00Z"},
            "seven_day_opus":null,"seven_day_sonnet":null,
            "extra_usage":{"is_enabled":false},"unknown_future_field":1}"#;
        let u = parse_usage(body).unwrap();
        assert_eq!(u.five_hour.as_ref().unwrap().utilization, 91.0);
        assert_eq!(u.seven_day.as_ref().unwrap().utilization, 25.5);
        assert!(u.seven_day_opus.is_none());
    }

    #[test]
    fn tolerates_empty_object() {
        assert_eq!(parse_usage("{}").unwrap(), Usage::default());
    }
}
