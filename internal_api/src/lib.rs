use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcNewOutput {
    pub id: String,
    pub state: StepResult,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcSummary {
    pub id: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcListOutput {
    pub procs: Vec<ProcSummary>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcNewRequest {
    pub src: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcSendRequest {
    pub msg: Value,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Default, Clone)]
pub enum StepResultStatus {
    #[default]
    DONE,
    SUSPEND,
    ERROR,
}

impl std::fmt::Display for StepResultStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
pub struct StepResult {
    pub status: StepResultStatus,
    pub val: Option<Value>,
    pub suspension: Option<Value>,
    pub current_frame: Option<u64>,
    pub frames: Option<Value>,
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
pub struct ProcStatus {
    pub status: StepResultStatus,
    pub val: Option<String>,
    pub suspension: Option<String>,
    pub executing: bool,
}

impl ProcStatus {
    pub fn new(step_result: StepResult, executing: bool) -> Self {
        ProcStatus {
            status: step_result.status,
            val: step_result
                .val
                .as_ref()
                .map(|v| serde_json::to_string(&v).unwrap_or("error".to_string())),
            suspension: step_result
                .suspension
                .as_ref()
                .map(|v| serde_json::to_string(&v).unwrap_or("error".to_string())),
            executing,
        }
    }
}
