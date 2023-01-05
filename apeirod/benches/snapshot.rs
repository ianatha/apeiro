use apeiro_engine::{Engine, StepResult};
use apeiro_internal_api::EngineStatus;
use criterion::async_executor::FuturesExecutor;
use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};

const CODE: &str = r#"
function makestr(length) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

var a = function a() {
  var state = []
  for (var i = 0; i < {iterations}; i++) {
    state.push(makestr(32));
  }
  return state;
}; 

export default a;
"#;

async fn run_engine(size: &usize) -> (Option<StepResult>, Option<EngineStatus>) {
    let mut engine = Engine::new(None);
    let (new_state, new_snapshot) = engine
        .step_process(CODE.replace("{iterations}", &size.to_string()), None, None)
        .await
        .unwrap();
    (Some(new_state), Some(new_snapshot))
}

pub fn criterion_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("strings");
    for size in [1_000, 5_000, 10_000, 25_000, 50_000].iter() {
        group.bench_with_input(BenchmarkId::new("snapshot", size), &size, |b, &s| {
            b.to_async(FuturesExecutor).iter(|| run_engine(s))
        });
    }
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
