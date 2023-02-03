use std::fmt::Debug;

use apeiro_compiler::CompilationResult;
use apeiro_internal_api::{
    EngineStatus, MountSummary, ProcDetails, ProcGetResponse, ProcStatusDebug, ProcSummary,
    StepResult,
};
use serde_json;

pub trait ApeiroPersistence: Sync + Send + Debug + 'static {
    fn init(&self) -> Result<(), anyhow::Error>;

    fn plugin_get_state(&self, name: &String) -> Result<serde_json::Value, anyhow::Error>;

    fn plugin_set_state(&self, name: &String, val: &serde_json::Value)
        -> Result<(), anyhow::Error>;

    fn proc_new(&self, mount_id: &String, name: &Option<String>) -> Result<String, anyhow::Error>;

    fn proc_subscription_new(
        &self,
        proc_id: &String,
        subscription: &serde_json::Value,
    ) -> Result<String, anyhow::Error>;

    fn proc_subscriptions_get_all(&self)
        -> Result<Vec<(String, serde_json::Value)>, anyhow::Error>;

    fn proc_rename_if_exists(
        &self,
        old_name: &String,
        new_name: &String,
    ) -> Result<(), anyhow::Error>;

    fn proc_update(
        &self,
        id: &String,
        state: &StepResult,
        engine_status: &EngineStatus,
    ) -> Result<(), anyhow::Error>;

    fn proc_get_details(&self, id: &String) -> Result<ProcDetails, anyhow::Error>;

    fn proc_get(&self, id: &String) -> Result<ProcGetResponse, anyhow::Error>;

    fn proc_list(&self) -> Result<Vec<ProcSummary>, anyhow::Error>;

    fn proc_inspect(&self, id: &String) -> Result<ProcStatusDebug, anyhow::Error>;

    fn proc_delete(&self, id: &String) -> Result<(), anyhow::Error>;

    fn mount_new(
        &self,
        name: &String,
        src: &String,
        compiled_src: &CompilationResult,
        singleton: Option<u32>,
    ) -> Result<String, anyhow::Error>;

    fn mount_find_by_hash(&self, hash_sha256: &String) -> Result<Option<String>, anyhow::Error>;

    fn mount_list(&self) -> Result<Vec<MountSummary>, anyhow::Error>;

    fn mount_get(&self, mount_id: &String) -> Result<MountSummary, anyhow::Error>;

    fn mount_edit(
        &self,
        mount_id: &String,
        new_src: &String,
        compiled_src: &String,
    ) -> Result<(), anyhow::Error>;
}

pub fn is_proc_id(s: &String) -> bool {
    s.len() == 21
}
