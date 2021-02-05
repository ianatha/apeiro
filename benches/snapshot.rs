use criterion::async_executor::FuturesExecutor;
use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use pristine_stepper::engine::Engine;

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
  
  var $module = function (){
	  var a = function a() {
		var state = []
		for (var i = 0; i < {iterations}; i++) {
		  state.push(makestr(32));
		}
		return {
		  g: function(id) { return state[id]; },
		}
	  }; 
	  return {
		default: a
	  }
  }();
  
  var million_strings = $module.default();
"#;

async fn run_engine(
    state_loc: Option<String>,
    snapshot_loc: Option<Vec<u8>>,
    size: &usize,
) -> (Option<String>, Option<Vec<u8>>) {
    let engine = Engine::new();
    let (new_state, new_snapshot) = engine
        .step_process(
            Some(
                CODE.replace("{iterations}", &size.to_string())
                    .as_bytes()
                    .to_vec(),
            ),
            state_loc,
            snapshot_loc,
            "million_strings.g(0)".to_string(),
        )
        .await
        .unwrap();
    (Some(new_state), Some(new_snapshot))
}

pub fn criterion_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("strings");
    for size in [1_000, 5_000, 10_000, 25_000, 50_000].iter() {
        group.bench_with_input(BenchmarkId::new("snapshot", size), &size, |b, &s| {
            b.to_async(FuturesExecutor)
                .iter(|| run_engine(None, None, s))
        });
    }
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
