
use colored::Colorize;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::StepResultStatus;

#[derive(Default, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub struct StepResult {
    pub status: StepResultStatus,
    pub val: Option<Value>,
    pub suspension: Option<Value>,
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
            .unwrap();
        if let Some(suspension) = &self.suspension {
            f.write_fmt(format_args!(
                "{}: {}",
                "suspension".bold(),
                serde_json::to_string_pretty(suspension).unwrap()
            ))
                .unwrap();
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
