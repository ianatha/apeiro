//! Stage 3 - syslog server rslogd
//!
//! MUST run as root or use sudo
//!
//! ```
//! cargo build
//! sudo target/debug/rslogd
//! ```
//!
//! # panics
//!
//! If socket cannot bind to syslog UDP port 514 (permissions or already in use)
//!

use std::time::Duration;

use apeiro_engine::plugins::ApeiroPlugin;
use apeiro_engine::DEngine;
use apeiro_engine::ProcSendRequest;

use anyhow;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use mio::net::{TcpListener, TcpStream, UdpSocket};
use mio::{Events, Poll, PollOpt, Ready, Token};
use socket2::{Domain, Protocol, Socket, Type};
use std::collections::HashMap;
use std::io::Read;
use std::io::{Error, ErrorKind};
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr};
use syslog::SyslogMsg;

mod syslog;

const SYSLOG_UDP_PORT: u16 = 1514;
const SYSLOG_TCP_PORT: u16 = 1601;
const UDP4: Token = Token(0);
const UDP6: Token = Token(1);
const TCP4: Token = Token(2);
const TCP6: Token = Token(3);

struct TcpConn {
    stream: TcpStream,
    sa: SocketAddr,
}

async fn cli_main(dengine: PrivateSender) -> Result<(), Error> {
    let mut events = Events::with_capacity(256);
    let poll = Poll::new()?;
    let mut buffer = [0; 4096];

    // listen to anyone
    let udp4_server_s = Socket::new(Domain::ipv4(), Type::dgram(), Some(Protocol::udp()))?;
    let sa_udp4 = SocketAddr::new(Ipv4Addr::new(0, 0, 0, 0).into(), SYSLOG_UDP_PORT);

    #[cfg(unix)]
    udp4_server_s.set_reuse_port(true)?;
    udp4_server_s.set_reuse_address(true)?;
    udp4_server_s.bind(&sa_udp4.into())?;
    let udp4_server_mio = UdpSocket::from_socket(udp4_server_s.into_udp_socket())?;

    poll.register(&udp4_server_mio, UDP4, Ready::readable(), PollOpt::edge())?;

    // listen over IPv6 too
    let udp6_server_s = Socket::new(Domain::ipv6(), Type::dgram(), Some(Protocol::udp()))?;
    let sa6 = SocketAddr::new(
        Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 0).into(),
        SYSLOG_UDP_PORT,
    );

    #[cfg(unix)]
    udp6_server_s.set_reuse_port(true)?;
    udp6_server_s.set_reuse_address(true)?;
    udp6_server_s.set_only_v6(true)?;
    udp6_server_s.bind(&sa6.into())?;
    let udp6_server_mio = UdpSocket::from_socket(udp6_server_s.into_udp_socket())?;

    poll.register(&udp6_server_mio, UDP6, Ready::readable(), PollOpt::edge())?;

    // TCP IPv4
    let tcp4_server_s = Socket::new(Domain::ipv4(), Type::stream(), Some(Protocol::tcp()))?;
    let sa_tcp4 = SocketAddr::new(Ipv4Addr::new(0, 0, 0, 0).into(), SYSLOG_TCP_PORT);
    tcp4_server_s.set_reuse_address(true)?;

    #[cfg(unix)]
    tcp4_server_s.set_reuse_port(true)?;
    tcp4_server_s.bind(&sa_tcp4.into())?;
    tcp4_server_s.listen(128)?;
    let tcp4_listener = TcpListener::from_std(tcp4_server_s.into_tcp_listener())?;
    poll.register(&tcp4_listener, TCP4, Ready::readable(), PollOpt::edge())?;

    // TCP IPv6
    let tcp6_server_s = Socket::new(Domain::ipv6(), Type::stream(), Some(Protocol::tcp()))?;
    let sa_tcp6 = SocketAddr::new(
        Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 0).into(),
        SYSLOG_TCP_PORT,
    );
    tcp6_server_s.set_reuse_address(true)?;

    #[cfg(unix)]
    tcp6_server_s.set_reuse_port(true)?;
    tcp6_server_s.set_only_v6(true)?;
    tcp6_server_s.bind(&sa_tcp6.into())?;
    tcp6_server_s.listen(128)?;
    let tcp6_listener = TcpListener::from_std(tcp6_server_s.into_tcp_listener())?;
    poll.register(&tcp6_listener, TCP6, Ready::readable(), PollOpt::edge())?;

    let mut tok_dyn = 10;
    let mut tcp_tokens: HashMap<Token, TcpConn> = HashMap::new();
    loop {
        poll.poll(&mut events, None)?;
        for event in events.iter() {
            match event.token() {
                UDP4 => match receive_udp(&dengine, &udp4_server_mio, &mut buffer).await {
                    Ok(()) => continue,
                    Err(e) => {
                        eprintln!("IPv4 receive {}", e);
                    }
                },
                UDP6 => match receive_udp(&dengine, &udp6_server_mio, &mut buffer).await {
                    Ok(()) => continue,
                    Err(e) => {
                        eprintln!("IPv6 receive {}", e);
                    }
                },
                TCP4 => match tcp4_listener.accept() {
                    Ok((stream, sa)) => {
                        let key = Token(tok_dyn);
                        poll.register(&stream, key, Ready::readable(), PollOpt::edge())?;
                        let conn = TcpConn {
                            stream: stream,
                            sa: sa,
                        };
                        tcp_tokens.insert(key, conn);
                        tok_dyn += 1;
                    }
                    Err(_e) => eprintln!("tcp4 connection error"),
                },
                TCP6 => match tcp6_listener.accept() {
                    Ok((stream, sa)) => {
                        let key = Token(tok_dyn);
                        poll.register(&stream, key, Ready::readable(), PollOpt::edge())?;
                        let conn = TcpConn {
                            stream: stream,
                            sa: sa,
                        };
                        tcp_tokens.insert(key, conn);
                        tok_dyn += 1;
                    }
                    Err(_e) => eprintln!("tcp6 connection error"),
                },
                tok => {
                    if let Some(conn_ref) = tcp_tokens.get_mut(&tok) {
                        if receive_tcp(&dengine, conn_ref, &mut buffer).await {
                            poll.deregister(&conn_ref.stream)?;
                            tcp_tokens.remove(&tok);
                        }
                    } else {
                        eprintln!("stream for token {:?} missing", tok);
                    }
                }
            }
        }
    }
}

// common receive routine
async fn receive_udp(
    dengine: &PrivateSender,
    sock: &UdpSocket,
    buf: &mut [u8],
) -> Result<(), Error> {
    loop {
        let (len, from) = match sock.recv_from(buf) {
            Ok((len, from)) => (len, from),
            Err(e) => {
                if e.kind() == ErrorKind::WouldBlock || e.kind() == ErrorKind::Interrupted {
                    return Ok(());
                } else {
                    return Err(e);
                }
            }
        };

        if let Some(msg) = syslog::parse(from, len, buf) {
            println!("\n\n\n\n\n\n\n\n{:?}\n\n\n\n\n\n\n\n", msg);
            dengine.send(msg).await;
        } else {
            match std::str::from_utf8(buf) {
                Ok(s) => eprintln!("error parsing: {}", s),
                Err(e) => eprintln!("received message not parseable and not UTF-8: {}", e),
            }
        }
    }
}

async fn receive_tcp(dengine: &PrivateSender, conn_ref: &mut TcpConn, buf: &mut [u8]) -> bool {
    loop {
        match conn_ref.stream.read(buf) {
            Ok(0) => {
                // client closed connection, cleanup
                return true;
            }
            Ok(len) => {
                // we have a message to process
                if let Some(msg) = syslog::parse(conn_ref.sa, len, buf) {
                    println!("\n\n\n\n\n\n\n\n{:?}\n\n\n\n\n\n\n\n", msg);
                    dengine.send(msg).await;
                } else {
                    println!(
                        "error parsing: {:?}",
                        String::from_utf8(buf[0..len].to_vec())
                    );
                }
            }
            Err(e) => {
                if e.kind() == ErrorKind::WouldBlock || e.kind() == ErrorKind::Interrupted {
                    // nothing else to read but connection still open
                    return false;
                } else {
                    eprintln!("TCP read error: {}", e);
                    // cleanup
                    return true;
                }
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyslogPlugin {
    port: u16,
    to_pid: String,
}

// async fn rcvd_notification(
//     dengine: &DEngine,
//     notification: Event,
//     to_pid: &String,
// ) -> Result<(), anyhow::Error> {
//     match notification {
//         Event::Incoming(msg) => match msg {
//             Incoming::Publish(p) => {
//                 let payload = std::str::from_utf8(&p.payload)?;
//                 if let Ok(payload_json) = serde_json::from_str::<serde_json::Value>(payload) {
//                     dengine
//                         .proc_send(to_pid.clone(), None, ProcSendRequest { msg: payload_json })
//                         .await
//                         .unwrap();
//                 }
//             }
//             _ => {
//                 println!("MQTT Received = {:?}", msg);
//             }
//         },
//         _ => {}
//     };
//     Ok(())
// }

struct PrivateSender {
    dengine: DEngine,
    to_pid: String,
}

impl PrivateSender {
    async fn send(&self, msg: SyslogMsg) {
        let dengine = self.dengine.clone();
        let msg = serde_json::to_value(msg).unwrap();
        let to_pid = self.to_pid.clone();
        apeiro_engine::dengine::spawn(async move {
            dengine
                .proc_send(to_pid, None, ProcSendRequest { msg })
                .await
                .unwrap();
        });
    }
}

#[typetag::serde]
#[async_trait]
impl ApeiroPlugin for SyslogPlugin {
    async fn init(&self, dengine: DEngine) -> Result<(), anyhow::Error> {
        let to_pid = self.to_pid.clone();
        apeiro_engine::dengine::spawn(async move {
            println!("listening");
            cli_main(PrivateSender { dengine, to_pid }).await.unwrap();
            // while let Ok(notification) = eventloop.poll().await {
            //     rcvd_notification(&dengine, notification, &to_pid)
            //         .await
            //         .unwrap();
            // }
        });

        Ok(())
    }
}
