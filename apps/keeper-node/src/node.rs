use libp2p::{
    gossipsub, identify, kad,
    noise, tcp, websocket, yamux,
    Multiaddr, PeerId, Swarm, SwarmBuilder,
    swarm::NetworkBehaviour,
};
use std::error::Error;
use std::time::Duration;

/// Combined network behavior for the keeper node.
#[derive(NetworkBehaviour)]
pub struct KeeperBehaviour {
    pub kademlia: kad::Behaviour<kad::store::MemoryStore>,
    pub gossipsub: gossipsub::Behaviour,
    pub identify: identify::Behaviour,
}

/// Create and configure the libp2p swarm for the keeper node.
///
/// Sets up:
/// - TCP + WebSocket transports
/// - Noise encryption
/// - Yamux stream multiplexing
/// - Kademlia DHT for record storage
/// - GossipSub for pub/sub messaging
/// - Identify protocol for peer identification
pub async fn create_node(
    port: u16,
    bootstrap_peers: &[String],
) -> Result<Swarm<KeeperBehaviour>, Box<dyn Error>> {
    let swarm = SwarmBuilder::with_new_identity()
        .with_tokio()
        .with_tcp(
            tcp::Config::default(),
            noise::Config::new,
            yamux::Config::default,
        )?
        .with_websocket(
            (noise::Config::new, noise::Config::new),
            yamux::Config::default,
        )
        .await?
        .with_behaviour(|key| {
            // Kademlia DHT
            let peer_id = key.public().to_peer_id();
            let store = kad::store::MemoryStore::new(peer_id);
            let kademlia = kad::Behaviour::new(peer_id, store);

            // GossipSub
            let gossipsub_config = gossipsub::ConfigBuilder::default()
                .heartbeat_interval(Duration::from_secs(10))
                .validation_mode(gossipsub::ValidationMode::Strict)
                .build()
                .expect("valid gossipsub config");

            let gossipsub = gossipsub::Behaviour::new(
                gossipsub::MessageAuthenticity::Signed(key.clone()),
                gossipsub_config,
            )
            .expect("valid gossipsub behaviour");

            // Identify
            let identify = identify::Behaviour::new(identify::Config::new(
                "/siphon/keeper/1.0.0".to_string(),
                key.public(),
            ));

            KeeperBehaviour {
                kademlia,
                gossipsub,
                identify,
            }
        })?
        .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(60)))
        .build();

    // Listen on TCP and WebSocket
    let listen_addr_tcp: Multiaddr = format!("/ip4/0.0.0.0/tcp/{}", port).parse()?;
    let listen_addr_ws: Multiaddr = format!("/ip4/0.0.0.0/tcp/{}/ws", port + 1).parse()?;

    let mut swarm = swarm;
    swarm.listen_on(listen_addr_tcp)?;
    swarm.listen_on(listen_addr_ws)?;

    // Connect to bootstrap peers
    for addr_str in bootstrap_peers {
        match addr_str.parse::<Multiaddr>() {
            Ok(addr) => {
                // Extract peer ID from the multiaddr if present
                if let Some(peer_id) = extract_peer_id(&addr) {
                    swarm.behaviour_mut().kademlia.add_address(&peer_id, addr.clone());
                    tracing::info!("Added bootstrap peer: {}", addr);
                }
                if let Err(e) = swarm.dial(addr.clone()) {
                    tracing::warn!("Failed to dial bootstrap peer {}: {}", addr, e);
                }
            }
            Err(e) => {
                tracing::warn!("Invalid bootstrap multiaddr '{}': {}", addr_str, e);
            }
        }
    }

    Ok(swarm)
}

/// Extract PeerId from a multiaddr that ends with /p2p/<peer_id>
fn extract_peer_id(addr: &Multiaddr) -> Option<PeerId> {
    addr.iter().find_map(|proto| {
        if let libp2p::multiaddr::Protocol::P2p(peer_id) = proto {
            Some(peer_id)
        } else {
            None
        }
    })
}
