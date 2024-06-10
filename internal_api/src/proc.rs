use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct ProcGetResponse {
    pub proc_id: String,
    pub module_id: String,
    pub name: Option<String>,
    pub step_result: crate::StepResult,
}
