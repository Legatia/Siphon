use libp2p::kad::{self, RecordKey};
use libp2p::Swarm;

use crate::node::KeeperBehaviour;
use crate::shard::Shard;

/// Publish a shard record to the Kademlia DHT.
///
/// The key is formatted as `/siphon/shard/<shard_id>` and the value
/// is the JSON-serialized shard data.
pub fn publish_shard_record(
    swarm: &mut Swarm<KeeperBehaviour>,
    shard: &Shard,
) -> Result<(), String> {
    let key = RecordKey::new(&format!("/siphon/shard/{}", shard.id));
    let value = serde_json::to_vec(shard)
        .map_err(|e| format!("Failed to serialize shard: {}", e))?;

    let record = kad::Record {
        key,
        value,
        publisher: None,
        expires: None,
    };

    swarm
        .behaviour_mut()
        .kademlia
        .put_record(record, kad::Quorum::One)
        .map_err(|e| format!("Failed to put DHT record: {:?}", e))?;

    tracing::info!("Published shard {} to DHT", &shard.id[..8]);
    Ok(())
}

/// Look up a shard record from the Kademlia DHT by shard ID.
///
/// This initiates an async DHT query. The result will arrive as a
/// `KademliaEvent::OutboundQueryProgressed` event on the swarm.
/// Returns the query ID for tracking.
pub fn lookup_shard(
    swarm: &mut Swarm<KeeperBehaviour>,
    shard_id: &str,
) -> kad::QueryId {
    let key = RecordKey::new(&format!("/siphon/shard/{}", shard_id));
    let query_id = swarm.behaviour_mut().kademlia.get_record(key);

    tracing::info!(
        "Initiated DHT lookup for shard {} (query: {:?})",
        &shard_id[..8.min(shard_id.len())],
        query_id
    );

    query_id
}

/// Publish an arbitrary key-value record to the DHT.
pub fn publish_record(
    swarm: &mut Swarm<KeeperBehaviour>,
    key: &str,
    value: Vec<u8>,
) -> Result<(), String> {
    let record = kad::Record {
        key: RecordKey::new(&key),
        value,
        publisher: None,
        expires: None,
    };

    swarm
        .behaviour_mut()
        .kademlia
        .put_record(record, kad::Quorum::One)
        .map_err(|e| format!("Failed to put DHT record: {:?}", e))?;

    Ok(())
}

/// Look up an arbitrary key from the DHT.
pub fn lookup_record(
    swarm: &mut Swarm<KeeperBehaviour>,
    key: &str,
) -> kad::QueryId {
    swarm
        .behaviour_mut()
        .kademlia
        .get_record(RecordKey::new(&key))
}
