mod repl;

use repl::*;

async fn read_lines(container: &mut Container) {
    use tokio::io::AsyncBufReadExt;
    let stdin = tokio::io::stdin();
    let mut reader = tokio::io::BufReader::new(stdin);
    let mut buffer = Vec::new();

    loop {
        use std::io::Write;

        print!("> ");
        std::io::stdout().flush().unwrap();    

        reader.read_until(b'\n', &mut buffer).await.unwrap();
        if buffer.len() == 0 {
            break;
        }
        let line = String::from_utf8(buffer.clone()).unwrap();
        buffer.clear();
        if line == "?\n" {
            let resp = container.inspect_scope().await;
            println!("scope: {:?}", resp);
            continue;
        }
        
        let resp = container.run(line).await;
        println!("< {:?}", resp);    
    }
    
    container.shutdown().await;
}

#[tokio::main]
async fn main() -> Result<(), std::io::Error> {
    v8_init();
     
    let (sender, receiver) = Container::new_channels();
    
    tokio::spawn(async move {
        let mut container = Container::new(sender);
        read_lines(&mut container).await;
    });

    let local = tokio::task::LocalSet::new();
    local.run_until(async move {
        tokio::task::spawn_local(async move {
            let mut event_loop = EventLoop::new(receiver);
            event_loop.run().await;
        }).await.unwrap();
    }).await;

    Ok(())
}
