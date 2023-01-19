use futures::StreamExt;
use libp2p::{
    core::upgrade,
    floodsub::{self, Floodsub, FloodsubEvent},
    identity, mdns, mplex, noise,
    ping::PingEvent,
    swarm::{NetworkBehaviour, SwarmEvent},
    tcp, Multiaddr, PeerId, Transport,
};
use std::error::Error;
use tokio::io::{self, AsyncBufReadExt};

pub async fn load_keys_or_generate() -> Result<identity::Keypair, Box<dyn Error>> {
    let file = tokio::fs::File::open("keys.binary").await;
    if let Ok(mut file) = file {
        let mut buffer = Vec::new();
        io::AsyncReadExt::read_to_end(&mut file, &mut buffer).await?;
        let keypair = identity::Keypair::from_protobuf_encoding(&buffer)?;
        Ok(keypair)
    } else {
        let keypair = identity::Keypair::generate_ed25519();
        let keypair_bytes = keypair.to_protobuf_encoding()?;
        let mut file = tokio::fs::File::create("keys.binary").await?;
        io::AsyncWriteExt::write_all(&mut file, &keypair_bytes).await?;
        Ok(keypair)
    }
}

pub async fn start_p2p() -> Result<(), Box<dyn Error>> {
    // Create a random PeerId
    let id_keys = load_keys_or_generate().await?;
    let peer_id = PeerId::from(id_keys.public());
    println!("Local peer id: {peer_id:?}");
    println!("pubi {:?}", id_keys.public());

    // Create a tokio-based TCP transport use noise for authenticated
    // encryption and Mplex for multiplexing of substreams on a TCP stream.
    let transport = tcp::tokio::Transport::new(tcp::Config::default().nodelay(true))
        .upgrade(upgrade::Version::V1)
        .authenticate(
            noise::NoiseAuthenticated::xx(&id_keys)
                .expect("Signing libp2p-noise static DH keypair failed."),
        )
        .multiplex(mplex::MplexConfig::new())
        .boxed();

    // Create a Floodsub topic
    let floodsub_topic = floodsub::Topic::new("chat");

    // We create a custom  behaviour that combines floodsub and mDNS.
    // The derive generates a delegating `NetworkBehaviour` impl.
    #[derive(NetworkBehaviour)]
    #[behaviour(out_event = "MyBehaviourEvent")]
    struct MyBehaviour {
        floodsub: Floodsub,
        mdns: mdns::tokio::Behaviour,
        ping: libp2p::ping::Behaviour,
    }

    #[allow(clippy::large_enum_variant)]
    #[derive(Debug)]
    enum MyBehaviourEvent {
        Floodsub(FloodsubEvent),
        Mdns(mdns::Event),
        Ping(libp2p::ping::Event),
    }

    impl From<libp2p::ping::Event> for MyBehaviourEvent {
        fn from(event: libp2p::ping::Event) -> Self {
            MyBehaviourEvent::Ping(event)
        }
    }

    impl From<FloodsubEvent> for MyBehaviourEvent {
        fn from(event: FloodsubEvent) -> Self {
            MyBehaviourEvent::Floodsub(event)
        }
    }

    impl From<mdns::Event> for MyBehaviourEvent {
        fn from(event: mdns::Event) -> Self {
            MyBehaviourEvent::Mdns(event)
        }
    }

    // Create a Swarm to manage peers and events.
    let mdns_behaviour = mdns::tokio::Behaviour::new(Default::default())?;
    let mut behaviour = MyBehaviour {
        floodsub: Floodsub::new(peer_id),
        mdns: mdns_behaviour,
        ping: libp2p::ping::Behaviour::new(libp2p::ping::Config::new().with_keep_alive(true)),
    };

    behaviour.floodsub.subscribe(floodsub_topic.clone());

    let mut swarm = libp2p::Swarm::with_tokio_executor(transport, behaviour, peer_id);

    // Reach out to another node if specified
    // if let Some(to_dial) = std::env::args().nth(1) {
    //     let addr: Multiaddr = to_dial.parse()?;
    //     swarm.dial(addr)?;
    //     println!("Dialed {to_dial:?}");
    // }

    // Read full lines from stdin
    let mut stdin = io::BufReader::new(io::stdin()).lines();

    // Listen on all interfaces and whatever port the OS assigns
    swarm.listen_on("/ip4/0.0.0.0/tcp/0".parse()?)?;

    use tokio::time::{self, Duration};

    let tick = time::interval(Duration::from_millis(1000));
    tokio::pin!(tick);

    // Kick it off
    loop {
        tokio::select! {
            // _ = tick.tick() => {
            //     println!("tick");
            // }
            line = stdin.next_line() => {
                let line = line?.expect("stdin closed");
                if line.starts_with("/connect ") {
                    let split = line.split(" ").collect::<Vec<&str>>();
                    let addr: Multiaddr = split[1].parse()?;
                    swarm.dial(addr)?;
                } else {
                    swarm.behaviour_mut().floodsub.publish(floodsub_topic.clone(), line.as_bytes());
                }
            }
            event = swarm.select_next_some() => {
                match event {
                    SwarmEvent::ConnectionEstablished { peer_id, endpoint, .. } => {
                        println!("Connection with {peer_id:?} established on {endpoint:?}");
                        swarm.behaviour_mut().floodsub.add_node_to_partial_view(peer_id);
                    }
                    SwarmEvent::NewListenAddr { address, .. } => {
                        println!("Listening on {address:?}");
                    }
                    SwarmEvent::Behaviour(MyBehaviourEvent::Floodsub(FloodsubEvent::Message(message))) => {
                        println!(
                                "Received: '{:?}' from {:?}",
                                String::from_utf8_lossy(&message.data),
                                message.source
                            );
                    }
                    SwarmEvent::Behaviour(MyBehaviourEvent::Mdns(event)) => {
                        match event {
                            mdns::Event::Discovered(list) => {
                                for (peer, addr) in list {
                                    println!("discovered {peer} {addr}");
                                    swarm.dial(addr.clone()).unwrap();

                                }
                            }
                            mdns::Event::Expired(list) => {
                                for (peer, addr) in list {
                                    println!("expired {peer} {addr}");
                                    if !swarm.behaviour().mdns.has_node(&peer) {
                                        // swarm.behaviour_mut().floodsub.remove_node_from_partial_view(&peer);
                                    }
                                }
                            }
                        }
                    }
                    e => {
                        println!("event {:?}", e);
                    }
                }
            }
        }
    }
}
