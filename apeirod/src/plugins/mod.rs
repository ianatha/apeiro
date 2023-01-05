use apeiro_engine::DEngine;
use async_trait::async_trait;

mod mqtt;

#[async_trait]
#[typetag::serde(tag = "module")]
pub trait ApeiroPlugin: std::fmt::Debug {
    async fn init(&self, dengine: DEngine) -> Result<(), anyhow::Error>;
}
