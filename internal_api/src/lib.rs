use colored::Colorize;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub type ApeiroId = String;

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcNewOutput {
    pub id: ApeiroId,
    pub state: StepResult,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcSummary {
    pub id: ApeiroId,
    pub name: Option<String>,
    pub status: StepResultStatus,
    pub suspension: Option<Value>,
    pub snapshot_size: u32,
    pub snapshot_v2_size: u32,
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
        match self {
            StepResultStatus::DONE => write!(f, "{}", "DONE".green()),
            StepResultStatus::SUSPEND => write!(f, "{}", "SUSPEND".yellow()),
            StepResultStatus::ERROR => write!(f, "{}", "ERROR".red()),
            StepResultStatus::CRASHED => write!(f, "{}", "CRASHED".red()),
        }
    }
}

#[derive(Default, Deserialize, Serialize, Clone)]
pub struct StepResult {
    pub status: StepResultStatus,
    pub val: Option<Value>,
    pub suspension: Option<Value>,
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
pub struct EngineStatus {
    pub frames: Option<Value>,
    pub funcs: Option<Value>,
}

impl std::fmt::Display for StepResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let val = match &self.val {
            Some(v) => serde_json::to_string_pretty(v).unwrap(),
            None => "".to_string(),
        };
        f.write_fmt(format_args!(
            "{}: {}\n{}: {}",
            "status".bold(),
            self.status,
            "val".bold(),
            val
        ))
    }
}

impl std::fmt::Debug for StepResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StepResult")
            .field("status", &self.status)
            .field("val", &self.val)
            .field("suspension", &self.suspension)
            .finish()
    }
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
pub struct ProcStatus {
    pub proc_id: String,
    pub name: Option<String>,
    pub status: StepResultStatus,
    pub val: Option<String>,
    pub suspension: Option<String>,
    pub executing: bool,
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
pub struct ProcStatusDebug {
    pub frames: Option<Value>,
    pub compiled_src: String,
    pub funcs: Option<Value>,
}

impl ProcStatus {
    pub fn new(
        proc_id: String,
        name: Option<String>,
        step_result: StepResult,
        executing: bool,
    ) -> Self {
        ProcStatus {
            proc_id,
            name,
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
pub struct ApeiroError {
    error: String,
}
