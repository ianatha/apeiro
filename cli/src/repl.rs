use std::env;
use crate::librepl;

async fn read_lines(container: &mut librepl::Container) {
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

pub async fn repl_main(scope_file: Option<String>) -> Result<(), std::io::Error> {
    librepl::v8_init();
     
    let (sender, receiver) = librepl::Container::new_channels();
    
    tokio::spawn(async move {
        let mut container = librepl::Container::new(sender);
        read_lines(&mut container).await;
    });

    let local = tokio::task::LocalSet::new();
    local.run_until(async move {
        tokio::task::spawn_local(async move {
            let mut event_loop = librepl::EventLoop::new(receiver, scope_file.unwrap_or("scope.json".into()));
            event_loop.run().await;
        }).await.unwrap();
    }).await;

    Ok(())
}
