use serde::{Deserialize, Serialize};
use serde_json::Value;

pub type PristineId = String;

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcNewOutput {
    pub id: PristineId,
    pub state: StepResult,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcSummary {
    pub id: PristineId,
    pub name: Option<String>,
    pub status: StepResultStatus,
    pub suspension: Option<Value>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcListOutput {
    pub procs: Vec<ProcSummary>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcNewRequest {
    pub src: String,
    pub name: Option<String>,
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
    CRASHED,
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

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
pub struct ProcStatusDebug {
    pub compiled_src: String,
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

#[derive(Debug, Deserialize, Serialize)]
pub struct PristineError {
    error: String,
}
