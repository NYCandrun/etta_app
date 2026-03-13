use reqwest::Client;

use super::types::{ApiError, MessagesRequest, MessagesResponse};

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const MAX_RETRIES: u32 = 1;

/// A thin wrapper around reqwest for calling the Claude Messages API.
pub struct ClaudeClient {
    http: Client,
    api_key: String,
}

impl ClaudeClient {
    pub fn new(api_key: &str) -> Self {
        let http = Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            http,
            api_key: api_key.to_string(),
        }
    }

    /// Send a non-streaming request to the Claude Messages API.
    /// Retries once on network errors.
    pub async fn send(&self, request: &MessagesRequest) -> Result<MessagesResponse, String> {
        let mut last_err = String::new();

        for attempt in 0..=MAX_RETRIES {
            match self.do_request(request).await {
                Ok(response) => return Ok(response),
                Err(e) => {
                    last_err = e.clone();
                    if attempt < MAX_RETRIES {
                        // Brief pause before retry.
                        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    }
                }
            }
        }

        Err(last_err)
    }

    /// Internal: execute a single request attempt.
    async fn do_request(&self, request: &MessagesRequest) -> Result<MessagesResponse, String> {
        let resp = self
            .http
            .post(ANTHROPIC_API_URL)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .header("content-type", "application/json")
            .json(request)
            .send()
            .await
            .map_err(|e| format!("Network error: {e}"))?;

        let status = resp.status();
        let body = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read response body: {e}"))?;

        if !status.is_success() {
            // Attempt to parse structured error.
            if let Ok(api_err) = serde_json::from_str::<ApiError>(&body) {
                return Err(format!(
                    "Claude API error ({}): {}",
                    api_err.error.error_type, api_err.error.message
                ));
            }
            return Err(format!("Claude API error (HTTP {status}): {body}"));
        }

        let parsed: MessagesResponse =
            serde_json::from_str(&body).map_err(|e| format!("Failed to parse response: {e}"))?;

        Ok(parsed)
    }

    /// Quick connectivity/key validation: sends a minimal request.
    pub async fn test_connection(&self) -> Result<bool, String> {
        let request = MessagesRequest::new(
            "claude-sonnet-4-20250514",
            16,
            None,
            vec![super::types::Message::user_text("Reply with OK.")],
            false,
        );

        match self.send(&request).await {
            Ok(_) => Ok(true),
            Err(e) => Err(e),
        }
    }
}

/// Extract the first text block from a MessagesResponse.
pub fn extract_text(response: &MessagesResponse) -> String {
    response
        .content
        .iter()
        .filter_map(|block| match block {
            super::types::ResponseContentBlock::Text { text } => Some(text.as_str()),
        })
        .collect::<Vec<_>>()
        .join("")
}
