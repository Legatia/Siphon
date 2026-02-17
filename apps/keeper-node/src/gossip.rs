use libp2p::gossipsub::{self, IdentTopic, TopicHash};
use libp2p::Swarm;

use crate::node::KeeperBehaviour;
use crate::shard::Shard;

/// GossipSub topic constants matching the TypeScript TOPICS.
pub const TOPIC_SHARD_SPAWN: &str = "/siphon/shard/spawn/1.0.0";
pub const TOPIC_WILD_DRIFT: &str = "/siphon/wild/drift/1.0.0";
pub const TOPIC_KEEPER_HEARTBEAT: &str = "/siphon/keeper/heartbeat/1.0.0";
pub const TOPIC_BATTLE_CHALLENGE: &str = "/siphon/battle/challenge/1.0.0";

/// Subscribe the swarm to all Siphon Protocol GossipSub topics.
pub fn subscribe_topics(swarm: &mut Swarm<KeeperBehaviour>) {
    let topics = [
        TOPIC_SHARD_SPAWN,
        TOPIC_WILD_DRIFT,
        TOPIC_KEEPER_HEARTBEAT,
        TOPIC_BATTLE_CHALLENGE,
    ];

    for topic_str in &topics {
        let topic = IdentTopic::new(*topic_str);
        match swarm.behaviour_mut().gossipsub.subscribe(&topic) {
            Ok(_) => tracing::info!("Subscribed to topic: {}", topic_str),
            Err(e) => tracing::warn!("Failed to subscribe to {}: {:?}", topic_str, e),
        }
    }
}

/// Handle an incoming GossipSub message.
/// Routes to the appropriate handler based on the topic.
pub fn handle_message(
    topic: &TopicHash,
    data: &[u8],
    source: &libp2p::PeerId,
) {
    let topic_str = topic.to_string();

    match topic_str.as_str() {
        TOPIC_SHARD_SPAWN => {
            match serde_json::from_slice::<Shard>(data) {
                Ok(shard) => {
                    tracing::info!(
                        "Received shard spawn from {}: {} [{}]",
                        &source.to_string()[..8],
                        shard.name,
                        shard.shard_type
                    );
                }
                Err(e) => {
                    tracing::warn!("Failed to parse shard spawn message: {}", e);
                }
            }
        }
        TOPIC_WILD_DRIFT => {
            tracing::debug!(
                "Received wild drift update from {} ({} bytes)",
                &source.to_string()[..8],
                data.len()
            );
        }
        TOPIC_KEEPER_HEARTBEAT => {
            tracing::debug!(
                "Received keeper heartbeat from {}",
                &source.to_string()[..8]
            );
        }
        TOPIC_BATTLE_CHALLENGE => {
            tracing::info!(
                "Received battle challenge from {} ({} bytes)",
                &source.to_string()[..8],
                data.len()
            );
        }
        _ => {
            tracing::trace!("Received message on unknown topic: {}", topic_str);
        }
    }
}

/// Publish a keeper heartbeat to the network.
/// Includes the keeper's peer ID, hosted shard count, and resource stats.
pub fn publish_heartbeat(
    swarm: &mut Swarm<KeeperBehaviour>,
    hosted_shard_count: usize,
    reputation: u64,
) -> Result<(), String> {
    let peer_id = *swarm.local_peer_id();
    let heartbeat = serde_json::json!({
        "keeper_id": peer_id.to_string(),
        "hosted_shards": hosted_shard_count,
        "reputation": reputation,
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    });

    let data = serde_json::to_vec(&heartbeat)
        .map_err(|e| format!("Failed to serialize heartbeat: {}", e))?;

    let topic = IdentTopic::new(TOPIC_KEEPER_HEARTBEAT);
    swarm
        .behaviour_mut()
        .gossipsub
        .publish(topic, data)
        .map_err(|e| format!("Failed to publish heartbeat: {:?}", e))?;

    tracing::debug!("Published keeper heartbeat");
    Ok(())
}

/// Publish a shard spawn event to the network.
pub fn publish_shard_spawn(
    swarm: &mut Swarm<KeeperBehaviour>,
    shard: &Shard,
) -> Result<(), String> {
    let data = serde_json::to_vec(shard)
        .map_err(|e| format!("Failed to serialize shard: {}", e))?;

    let topic = IdentTopic::new(TOPIC_SHARD_SPAWN);
    swarm
        .behaviour_mut()
        .gossipsub
        .publish(topic, data)
        .map_err(|e| format!("Failed to publish shard spawn: {:?}", e))?;

    tracing::info!("Published shard spawn: {} [{}]", shard.name, shard.shard_type);
    Ok(())
}

/// Publish a battle challenge to the network.
pub fn publish_battle_challenge(
    swarm: &mut Swarm<KeeperBehaviour>,
    challenge_data: &serde_json::Value,
) -> Result<(), String> {
    let data = serde_json::to_vec(challenge_data)
        .map_err(|e| format!("Failed to serialize challenge: {}", e))?;

    let topic = IdentTopic::new(TOPIC_BATTLE_CHALLENGE);
    swarm
        .behaviour_mut()
        .gossipsub
        .publish(topic, data)
        .map_err(|e| format!("Failed to publish battle challenge: {:?}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn topic_strings_match_typescript() {
        // These must match the TypeScript TOPICS in packages/p2p
        assert_eq!(TOPIC_SHARD_SPAWN, "/siphon/shard/spawn/1.0.0");
        assert_eq!(TOPIC_WILD_DRIFT, "/siphon/wild/drift/1.0.0");
        assert_eq!(TOPIC_KEEPER_HEARTBEAT, "/siphon/keeper/heartbeat/1.0.0");
        assert_eq!(TOPIC_BATTLE_CHALLENGE, "/siphon/battle/challenge/1.0.0");
    }

    #[test]
    fn topics_start_with_siphon_prefix() {
        for topic in &[TOPIC_SHARD_SPAWN, TOPIC_WILD_DRIFT, TOPIC_KEEPER_HEARTBEAT, TOPIC_BATTLE_CHALLENGE] {
            assert!(topic.starts_with("/siphon/"));
        }
    }

    #[test]
    fn topics_end_with_version() {
        for topic in &[TOPIC_SHARD_SPAWN, TOPIC_WILD_DRIFT, TOPIC_KEEPER_HEARTBEAT, TOPIC_BATTLE_CHALLENGE] {
            assert!(topic.ends_with("/1.0.0"));
        }
    }
}
