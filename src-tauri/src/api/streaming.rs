use super::types::StreamDelta;

/// Parsed SSE event from a Claude streaming response.
#[derive(Debug, Clone)]
pub enum SseEvent {
    /// A delta containing new text.
    TextDelta(String),
    /// The stream has ended.
    Done,
    /// A non-text event we can ignore.
    Other(String),
}

/// Parse a buffer of SSE lines into events.
/// SSE format:
///   event: <event_type>
///   data: <json>
///   (blank line)
pub struct SseParser {
    buffer: String,
}

impl SseParser {
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
        }
    }

    /// Feed a chunk of bytes into the parser and return any complete events.
    pub fn feed(&mut self, chunk: &str) -> Vec<SseEvent> {
        self.buffer.push_str(chunk);
        let mut events = Vec::new();

        // Process complete event blocks (separated by double newlines).
        while let Some(block_end) = self.buffer.find("\n\n") {
            let block = self.buffer[..block_end].to_string();
            self.buffer = self.buffer[block_end + 2..].to_string();

            if let Some(event) = parse_event_block(&block) {
                events.push(event);
            }
        }

        events
    }
}

fn parse_event_block(block: &str) -> Option<SseEvent> {
    let mut event_type = String::new();
    let mut data_lines = Vec::new();

    for line in block.lines() {
        if let Some(value) = line.strip_prefix("event: ") {
            event_type = value.trim().to_string();
        } else if let Some(value) = line.strip_prefix("data: ") {
            data_lines.push(value.to_string());
        } else if let Some(value) = line.strip_prefix("data:") {
            data_lines.push(value.to_string());
        }
    }

    let data = data_lines.join("\n");

    match event_type.as_str() {
        "content_block_delta" => {
            // Parse the delta JSON to extract text.
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&data) {
                if let Some(delta) = parsed.get("delta") {
                    if let Ok(d) = serde_json::from_value::<StreamDelta>(delta.clone()) {
                        if let Some(text) = d.text {
                            return Some(SseEvent::TextDelta(text));
                        }
                    }
                }
            }
            Some(SseEvent::Other(event_type))
        }
        "message_stop" => Some(SseEvent::Done),
        "message_start" | "content_block_start" | "content_block_stop" | "ping" => {
            Some(SseEvent::Other(event_type))
        }
        _ => {
            if !event_type.is_empty() {
                Some(SseEvent::Other(event_type))
            } else {
                None
            }
        }
    }
}

/// Convenience: collect all text from a streaming response into a single string.
/// Takes the raw reqwest Response and consumes it.
pub async fn collect_stream_text(response: reqwest::Response) -> Result<String, String> {
    use futures_lite::StreamExt;
    use reqwest::Response;

    let mut parser = SseParser::new();
    let mut full_text = String::new();

    let mut stream = response.bytes_stream();

    // We use a manual loop with pin since bytes_stream requires Stream trait.
    // reqwest's bytes_stream returns impl Stream<Item = Result<Bytes, reqwest::Error>>.
    let mut stream = std::pin::pin!(stream);

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream read error: {e}"))?;
        let chunk_str = String::from_utf8_lossy(&chunk);

        for event in parser.feed(&chunk_str) {
            match event {
                SseEvent::TextDelta(text) => full_text.push_str(&text),
                SseEvent::Done => return Ok(full_text),
                SseEvent::Other(_) => {}
            }
        }
    }

    Ok(full_text)
}
