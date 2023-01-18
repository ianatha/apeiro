use async_trait::async_trait;
use serde::{Serialize, Deserialize};

use crate::DEngine;

#[async_trait]
#[typetag::serde(tag = "module")]
pub trait ApeiroPlugin: std::fmt::Debug {
    async fn init(&self, dengine: DEngine) -> Result<(), anyhow::Error>;
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginConfiguration {
    pub plugins: Vec<Box<dyn ApeiroPlugin>>,
}
