use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Deserialize, Serialize, Debug)]
pub struct ProcSummary {
    pub id: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct ProcListOutput {
    pub procs: Vec<ProcSummary>,
}

#[derive(Serialize, Debug, Clone)]
pub struct ProcState {
    pub id: String,
    pub status: StepResultStatus,
    pub val: Option<Value>,
    pub suspension: Option<Value>,
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

#[derive(Debug, Deserialize)]
pub struct StepResult {
    pub status: StepResultStatus,
    pub val: Option<Value>,
    pub suspension: Option<Value>,
}
