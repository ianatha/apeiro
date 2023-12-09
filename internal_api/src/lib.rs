use colored::Colorize;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub type ApeiroId = String;

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcGetResponse {
    pub proc_id: String,
    pub module_id: String,
    pub name: Option<String>,
    pub step_result: StepResult,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcDetails {
    pub pid: String,
    pub module_id: String,
    pub name: Option<String>,
    pub compiled_src: String,
    pub engine_status: EngineStatus,
    pub state: StepResult,
}

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
    pub module_id: String,
    pub name: Option<String>,
    pub version: Option<u32>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ModuleEditRequest {
    pub src: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ModuleNewRequest {
    pub name: Option<String>,
    pub src: String,
    pub singleton: Option<bool>,
    pub src_is_compiled: Option<bool>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProcSendRequest {
    pub msg: Value,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Default, Clone, Eq)]
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

#[derive(Default, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub struct StepResult {
    pub status: StepResultStatus,
    pub val: Option<Value>,
    pub suspension: Option<Value>,
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
pub struct EngineStatus {
    pub frames: Option<Value>,
    pub funcs: Option<Value>,
    pub snapshot: Option<Vec<u8>>,
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
        )).unwrap();
        if let Some(suspension) = &self.suspension {
            f.write_fmt(format_args!(
                "{}: {}",
                "suspension".bold(),
                serde_json::to_string_pretty(suspension).unwrap()
            )).unwrap();
        };
        Ok(())
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
    pub module_id: String,
    pub name: Option<String>,
    pub status: StepResultStatus,
    pub val: Option<serde_json::Value>,
    pub suspension: Option<serde_json::Value>,
    pub executing: bool,
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
pub struct ProcStatusDebug {
    pub frames: Option<Value>,
    pub funcs: Option<Value>,
}

impl ProcStatus {
    pub fn new(
        proc_id: String,
        module_id: String,
        name: Option<String>,
        step_result: StepResult,
        executing: bool,
    ) -> Self {
        ProcStatus {
            proc_id,
            module_id,
            name,
            status: step_result.status,
            val: step_result.val,
            suspension: step_result.suspension,
            executing,
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ApeiroError {
    pub error: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ModuleSummary {
    pub id: String,
    pub src: String,
    pub compiled_src: String,
    pub name: String,
    pub singleton: Option<u32>,
    pub procs: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct StackTraceFrame {
    pub script_name: String,
    pub func_name: String,
    pub line_number: u32,
    pub column_number: u32,
}
