use siphon_keeper::{api, chain, config, db, gossip, keeper, monitor, node, shard};

use clap::{Parser, Subcommand};
use colored::Colorize;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(
    name = "siphon-keeper",
    about = "Siphon Protocol Keeper Node — host, train, and battle AI shards on the decentralized network",
    version
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the keeper node and begin serving shards
    Start {
        /// Port to listen on for P2P connections
        #[arg(short, long, default_value_t = 9000)]
        port: u16,

        /// Bootstrap peer multiaddrs to connect to
        #[arg(short, long)]
        bootstrap: Vec<String>,

        /// HTTP API port (overrides config file)
        #[arg(long)]
        http_port: Option<u16>,
    },

    /// Stake ETH to participate in the keeper network
    Stake {
        /// Amount of ETH to stake
        #[arg(short, long)]
        amount: f64,
    },

    /// Request to unstake and withdraw from the keeper network
    Unstake,

    /// Show current node status, reputation, and resource usage
    Status,

    /// Manage hosted shards
    #[command(subcommand)]
    Shards(ShardsCommands),

    /// Configuration management
    #[command(subcommand)]
    Config(ConfigCommands),
}

#[derive(Subcommand)]
enum ShardsCommands {
    /// List all shards hosted by this keeper
    List,

    /// Spawn a new shard on this keeper
    Spawn {
        /// Shard type (oracle, cipher, scribe, muse, architect, advocate, sentinel, mirror)
        #[arg(short = 't', long = "type")]
        shard_type: Option<String>,
    },

    /// Release a shard back into the wild
    Release {
        /// ID of the shard to release
        id: String,
    },
}

#[derive(Subcommand)]
enum ConfigCommands {
    /// Initialize a new configuration file at ~/.siphon/config.toml
    Init,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("siphon_keeper=info".parse().unwrap()))
        .init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Start { port, bootstrap, http_port } => {
            println!(
                "{} Starting Siphon Keeper on port {}...",
                ">>".bright_cyan(),
                port.to_string().bright_green()
            );

            if !bootstrap.is_empty() {
                println!(
                    "   {} bootstrap peers: {}",
                    ">>".bright_cyan(),
                    bootstrap.len().to_string().bright_yellow()
                );
                for peer in &bootstrap {
                    println!("      {}", peer.dimmed());
                }
            }

            let mut cfg = match config::Config::load() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!(
                        "{} Failed to load config: {}. Run `siphon-keeper config init` first.",
                        "!!".bright_red(),
                        e
                    );
                    std::process::exit(1);
                }
            };

            // CLI --http-port overrides config file
            if let Some(hp) = http_port {
                cfg.http_port = hp;
            }

            db::init_db(&cfg.data_dir).expect("Failed to initialize database");

            // Start HTTP API server
            let api_port = cfg.http_port;
            let shared_state = Arc::new(RwLock::new(api::AppState {
                config: cfg.clone(),
                jobs: std::collections::HashMap::new(),
            }));
            let app = api::router(shared_state);

            let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", api_port))
                .await
                .unwrap_or_else(|e| {
                    eprintln!(
                        "{} Failed to bind HTTP on port {}: {}",
                        "!!".bright_red(),
                        api_port,
                        e
                    );
                    std::process::exit(1);
                });

            println!(
                "{} HTTP API listening on {}",
                "OK".bright_green(),
                format!("http://0.0.0.0:{}", api_port).bright_white()
            );

            tokio::spawn(async move {
                axum::serve(listener, app).await.ok();
            });

            // Start P2P node
            match node::create_node(port, &bootstrap).await {
                Ok(mut swarm) => {
                    println!(
                        "{} Node started. PeerId: {}",
                        "OK".bright_green(),
                        swarm.local_peer_id().to_string().bright_cyan()
                    );

                    gossip::subscribe_topics(&mut swarm);

                    let keeper_state = keeper::KeeperState::new(cfg);

                    println!(
                        "{} Keeper node is live. Listening for shard events...",
                        ">>".bright_cyan()
                    );

                    let mut keeper_state = keeper_state;
                    keeper_state.run(&mut swarm).await;
                }
                Err(e) => {
                    eprintln!("{} Failed to create node: {}", "!!".bright_red(), e);
                    std::process::exit(1);
                }
            }
        }

        Commands::Stake { amount } => {
            println!(
                "{} Staking {} ETH to the keeper network...",
                ">>".bright_cyan(),
                amount.to_string().bright_yellow()
            );

            let cfg = match config::Config::load() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("{} {}", "!!".bright_red(), e);
                    std::process::exit(1);
                }
            };

            match chain::stake(&cfg, amount).await {
                Ok(msg) => println!("{} {}", "OK".bright_green(), msg),
                Err(e) => {
                    eprintln!("{} {}", "!!".bright_red(), e);
                    std::process::exit(1);
                }
            }
        }

        Commands::Unstake => {
            println!(
                "{} Requesting unstake from the keeper network...",
                ">>".bright_cyan()
            );

            let cfg = match config::Config::load() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("{} {}", "!!".bright_red(), e);
                    std::process::exit(1);
                }
            };

            match chain::unstake(&cfg).await {
                Ok(msg) => println!("{} {} Cooldown period: 7 days.", "OK".bright_green(), msg),
                Err(e) => {
                    eprintln!("{} {}", "!!".bright_red(), e);
                    std::process::exit(1);
                }
            }
        }

        Commands::Status => {
            println!("{} Siphon Keeper Status", ">>".bright_cyan());
            println!("{}", "─".repeat(40).dimmed());

            let stats = monitor::get_system_stats();
            println!("   CPU Usage:    {}", format!("{:.1}%", stats.cpu_usage).bright_yellow());
            println!("   Memory:       {}", format!("{:.1} MB / {:.1} MB", stats.memory_used_mb, stats.memory_total_mb).bright_yellow());
            println!("   Disk:         {}", format!("{:.1} GB free", stats.disk_free_gb).bright_yellow());
            println!("   Uptime:       {}", format!("{}s", stats.uptime_secs).bright_yellow());
            println!("{}", "─".repeat(40).dimmed());
            println!("   Shards:       {}", "(run `shards list`)".dimmed());

            // Try to read on-chain keeper info
            let cfg = config::Config::load().ok();
            if let Some(ref cfg) = cfg {
                if cfg.keeper_staking_address.is_some() {
                    // Derive keeper address from private key
                    match std::fs::read_to_string(
                        cfg.private_key_path.replace("~/", &format!("{}/", std::env::var("HOME").unwrap_or_default()))
                    ) {
                        Ok(key_hex) => {
                            let key_hex = key_hex.trim().trim_start_matches("0x");
                            if let Ok(signer) = <alloy::signers::local::PrivateKeySigner as std::str::FromStr>::from_str(key_hex) {
                                let keeper_addr = format!("{:?}", signer.address());
                                match chain::get_keeper_info(cfg, &keeper_addr).await {
                                    Ok((staked, _unstake_at, rewards, active)) => {
                                        let staked_eth = staked.to_string().parse::<f64>().unwrap_or(0.0) / 1e18;
                                        let rewards_eth = rewards.to_string().parse::<f64>().unwrap_or(0.0) / 1e18;
                                        println!("   Stake:        {}", format!("{:.4} ETH", staked_eth).bright_yellow());
                                        println!("   Rewards:      {}", format!("{:.4} ETH", rewards_eth).bright_yellow());
                                        println!("   Active:       {}", if active { "Yes".bright_green() } else { "No".bright_red() });
                                    }
                                    Err(e) => {
                                        println!("   Stake:        {}", format!("Error: {}", e).bright_red());
                                    }
                                }
                            } else {
                                println!("   Stake:        {}", "Invalid private key".bright_red());
                            }
                        }
                        Err(_) => {
                            println!("   Stake:        {}", "Key file not found".bright_red());
                        }
                    }
                } else {
                    println!("   Stake:        {}", "Not configured".dimmed());
                }
            } else {
                println!("   Stake:        {}", "Config not loaded".dimmed());
            }
        }

        Commands::Shards(sub) => match sub {
            ShardsCommands::List => {
                let cfg = config::Config::load().unwrap_or_default();
                match db::get_shards(&cfg.data_dir) {
                    Ok(shards) => {
                        if shards.is_empty() {
                            println!("{} No shards hosted. Use `shards spawn` to create one.", ">>".bright_cyan());
                        } else {
                            println!("{} Hosted Shards ({})", ">>".bright_cyan(), shards.len());
                            println!("{}", "─".repeat(60).dimmed());
                            for s in &shards {
                                println!(
                                    "   {} [{}] {} (Lv.{}) — {}",
                                    s.id[..8].bright_cyan(),
                                    s.shard_type.bright_magenta(),
                                    s.name.bright_white(),
                                    s.level.to_string().bright_yellow(),
                                    s.species.dimmed()
                                );
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("{} Failed to read shards: {}", "!!".bright_red(), e);
                    }
                }
            }

            ShardsCommands::Spawn { shard_type } => {
                let type_name = shard_type.as_deref().unwrap_or("random");
                println!(
                    "{} Spawning a new {} shard...",
                    ">>".bright_cyan(),
                    type_name.bright_magenta()
                );

                let new_shard = shard::Shard::spawn(shard_type.as_deref());
                println!(
                    "{} Shard spawned: {} [{}] — {}",
                    "OK".bright_green(),
                    new_shard.name.bright_white(),
                    new_shard.shard_type.bright_magenta(),
                    new_shard.id[..8].bright_cyan()
                );

                let cfg = config::Config::load().unwrap_or_default();
                if let Err(e) = db::insert_shard(&cfg.data_dir, &new_shard) {
                    eprintln!("{} Failed to persist shard: {}", "!!".bright_red(), e);
                }
            }

            ShardsCommands::Release { id } => {
                println!(
                    "{} Releasing shard {}...",
                    ">>".bright_cyan(),
                    id[..8.min(id.len())].bright_cyan()
                );

                let cfg = config::Config::load().unwrap_or_default();
                if let Err(e) = db::delete_shard(&cfg.data_dir, &id) {
                    eprintln!("{} Failed to release shard: {}", "!!".bright_red(), e);
                } else {
                    println!(
                        "{} Shard released back into the wild.",
                        "OK".bright_green()
                    );
                }
            }
        },

        Commands::Config(sub) => match sub {
            ConfigCommands::Init => {
                match config::Config::create_default() {
                    Ok(path) => {
                        println!(
                            "{} Configuration created at {}",
                            "OK".bright_green(),
                            path.bright_white()
                        );
                    }
                    Err(e) => {
                        eprintln!("{} Failed to create config: {}", "!!".bright_red(), e);
                    }
                }
            }
        },
    }
}
