use std::path::Path;

use futures::AsyncWriteExt;
use tokio::{net::UnixStream, io::{BufReader, AsyncBufReadExt}};
use tokio_util::compat::Compat;


pub struct PluginClient {

}

pub struct ClientConfig {
	pub cmd: tokio::process::Command,
}

pub fn new_client(mut config: ClientConfig) -> PluginClient {
	use std::process::Stdio;

	config.cmd.stdout(Stdio::piped());
	config.cmd.env("BASIC_PLUGIN", "hello");

    let mut child = config.cmd.spawn()
        .expect("failed to spawn command");

    let stdout = child.stdout.take()
        .expect("child did not have a handle to stdout");

	let mut reader = BufReader::new(stdout).lines();

	tokio::spawn(async move {
        let status = child.wait().await
            .expect("child process encountered an error");

        println!("child status was: {}", status);
    });

	// Ensure the child process is spawned in the runtime so it can
	// make progress on its own while we await for any output.
	tokio::spawn(async move {
		while let Some(line) = reader.next_line().await.expect("child process no next line") {
			println!("Line: {}", line);
			let parts = line.split('|').collect::<Vec<&str>>();
			let addr = parts[3].to_owned();
			println!("should connect to {}", addr);
			tokio::spawn(async move {
				println!("connecting to {}", addr);
				let path = Path::new(&addr);
				let mut sock = UnixStream::connect(path).await.expect("connect failed");
				let a = tokio_util::compat::TokioAsyncReadCompatExt::compat(sock);
				let mux_connection: yamux::Connection<Compat<UnixStream>> = yamux::Connection::new(a, yamux::Config::default(), yamux::Mode::Client);

				println!("connected mux");
				let (mut mux_control, controlled_connection) = yamux::Control::new(mux_connection);
				println!("connected control");
				let mut stream = mux_control.open_stream().await.expect("open stream failed");
				stream.write_all(b"hello_wrold\n\n").await.expect("write failed");
				println!("wrote hello world");
				
				// yamux::Stream::new(mux).await.expect("open stream failed");


				// let bytes_written = sock.write(b"test").await.expect("write failed");
				
				
			});
		}
	});
	
	println!("ext_plugin started");

	PluginClient {  }
}
