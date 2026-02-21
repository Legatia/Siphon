use libp2p::futures::StreamExt;
use libp2p::swarm::SwarmEvent;
use libp2p::Swarm;
use std::collections::HashMap;
use std::time::{Duration, Instant};

use crate::chain;
use crate::config::Config;
use crate::db;
use crate::gossip;
use crate::node::KeeperBehaviour;
use crate::shard::Shard;

/// Interval between keeper heartbeats broadcast to the network.
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);

/// Interval between liquidation checks (1 hour).
const LIQUIDATION_CHECK_INTERVAL: Duration = Duration::from_secs(3600);

/// State of the keeper node, tracking hosted shards and reputation.
pub struct KeeperState {
    pub config: Config,
    pub hosted_shards: HashMap<String, Shard>,
    pub reputation: u64,
    pub last_heartbeat: Instant,
    pub started_at: Instant,
}

impl KeeperState {
    pub fn new(config: Config) -> Self {
        Self {
            config,
            hosted_shards: HashMap::new(),
            reputation: 100,
            last_heartbeat: Instant::now(),
            started_at: Instant::now(),
        }
    }

    /// Spawn a new shard and add it to this keeper's hosted set.
    pub fn spawn_shard(&mut self, shard_type: Option<&str>) -> Shard {
        let shard = Shard::spawn(shard_type);
        self.hosted_shards.insert(shard.id.clone(), shard.clone());
        tracing::info!(
            "Keeper now hosting shard {} [{}] — total: {}",
            shard.name,
            shard.shard_type,
            self.hosted_shards.len()
        );
        shard
    }

    /// Release a shard from this keeper, returning it if found.
    pub fn release_shard(&mut self, shard_id: &str) -> Option<Shard> {
        let shard = self.hosted_shards.remove(shard_id);
        if let Some(ref s) = shard {
            tracing::info!(
                "Released shard {} [{}] — remaining: {}",
                s.name,
                s.shard_type,
                self.hosted_shards.len()
            );
        }
        shard
    }

    /// Sync hosted_shards from SQLite so P2P heartbeat reflects HTTP-spawned shards.
    fn sync_from_db(&mut self) {
        if let Ok(shards) = db::get_shards(&self.config.data_dir) {
            self.hosted_shards.clear();
            for shard in shards {
                self.hosted_shards.insert(shard.id.clone(), shard);
            }
        }
    }

    /// Check if it's time to send a heartbeat and do so if needed.
    fn maybe_send_heartbeat(&mut self, swarm: &mut Swarm<KeeperBehaviour>) {
        if self.last_heartbeat.elapsed() >= HEARTBEAT_INTERVAL {
            // Sync from SQLite to include shards created via HTTP API
            self.sync_from_db();

            let _ = gossip::publish_heartbeat(
                swarm,
                self.hosted_shards.len(),
                self.reputation,
            );
            self.last_heartbeat = Instant::now();
        }
    }

    /// Check funded loans for liquidation eligibility and log warnings.
    async fn check_liquidations(&self) {
        let loans = match db::get_funded_loans(&self.config.data_dir) {
            Ok(loans) => loans,
            Err(e) => {
                tracing::warn!("Failed to fetch funded loans: {}", e);
                return;
            }
        };

        if loans.is_empty() {
            return;
        }

        tracing::info!("Checking {} funded loans for liquidation", loans.len());

        for loan_id in &loans {
            match chain::check_liquidatable(&self.config, loan_id).await {
                Ok(true) => {
                    tracing::warn!("Loan {} is liquidatable. Attempting liquidation...", loan_id);
                    match chain::liquidate_loan(&self.config, loan_id).await {
                        Ok(tx) => {
                            tracing::info!("Loan {} liquidated: {}", loan_id, tx);
                            if let Err(e) = db::untrack_loan(&self.config.data_dir, loan_id) {
                                tracing::warn!(
                                    "Liquidated loan {}, but failed to untrack in DB: {}",
                                    loan_id,
                                    e
                                );
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Auto-liquidation failed for loan {}: {}", loan_id, e);
                        }
                    }
                }
                Ok(false) => {
                    tracing::debug!("Loan {} is healthy", loan_id);
                }
                Err(e) => {
                    tracing::debug!("Could not check loan {}: {}", loan_id, e);
                }
            }
        }
    }

    /// Main event loop for the keeper node.
    /// Processes swarm events and runs periodic tasks.
    pub async fn run(&mut self, swarm: &mut Swarm<KeeperBehaviour>) {
        let mut heartbeat_interval = tokio::time::interval(HEARTBEAT_INTERVAL);
        let mut liquidation_interval = tokio::time::interval(LIQUIDATION_CHECK_INTERVAL);

        loop {
            tokio::select! {
                event = swarm.select_next_some() => {
                    self.handle_swarm_event(event, swarm);
                }
                _ = heartbeat_interval.tick() => {
                    self.maybe_send_heartbeat(swarm);
                }
                _ = liquidation_interval.tick() => {
                    self.check_liquidations().await;
                }
            }
        }
    }

    /// Handle a single swarm event.
    fn handle_swarm_event(
        &mut self,
        event: SwarmEvent<crate::node::KeeperBehaviourEvent>,
        _swarm: &mut Swarm<KeeperBehaviour>,
    ) {
        match event {
            SwarmEvent::Behaviour(crate::node::KeeperBehaviourEvent::Gossipsub(
                libp2p::gossipsub::Event::Message {
                    propagation_source,
                    message,
                    ..
                },
            )) => {
                gossip::handle_message(
                    &message.topic,
                    &message.data,
                    &propagation_source,
                );
            }

            SwarmEvent::Behaviour(crate::node::KeeperBehaviourEvent::Kademlia(
                libp2p::kad::Event::OutboundQueryProgressed { result, .. },
            )) => {
                match result {
                    libp2p::kad::QueryResult::GetRecord(Ok(
                        libp2p::kad::GetRecordOk::FoundRecord(peer_record),
                    )) => {
                        tracing::info!(
                            "DHT record found: key={:?}, {} bytes",
                            peer_record.record.key,
                            peer_record.record.value.len()
                        );
                    }
                    libp2p::kad::QueryResult::PutRecord(Ok(_)) => {
                        tracing::debug!("DHT record stored successfully");
                    }
                    _ => {}
                }
            }

            SwarmEvent::Behaviour(crate::node::KeeperBehaviourEvent::Identify(
                identify_event,
            )) => {
                if let libp2p::identify::Event::Received { peer_id, info, .. } = identify_event {
                    tracing::debug!(
                        "Identified peer {}: {}",
                        &peer_id.to_string()[..8],
                        info.protocol_version
                    );
                }
            }

            SwarmEvent::NewListenAddr { address, .. } => {
                tracing::info!("Listening on {}", address);
            }

            SwarmEvent::ConnectionEstablished { peer_id, .. } => {
                tracing::info!("Connected to peer {}", &peer_id.to_string()[..8]);
            }

            SwarmEvent::ConnectionClosed { peer_id, .. } => {
                tracing::debug!("Disconnected from peer {}", &peer_id.to_string()[..8]);
            }

            _ => {}
        }
    }
}
