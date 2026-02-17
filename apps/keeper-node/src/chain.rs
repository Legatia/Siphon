use alloy::{
    network::EthereumWallet,
    primitives::{Address, U256},
    providers::ProviderBuilder,
    signers::local::PrivateKeySigner,
    sol,
};
use std::str::FromStr;

use crate::config::Config;

// ABI bindings for the ShardRegistry contract
sol! {
    #[sol(rpc)]
    interface IShardRegistry {
        function register(bytes32 shardId, bytes32 genomeHash) external;
        function transferOwnership(bytes32 shardId, address to) external;
        function setWild(bytes32 shardId) external;
        function getOwner(bytes32 shardId) external view returns (address);
        function getOrigin(bytes32 shardId) external view returns (address);
        function approveLock(address locker) external;
        function revokeLock(address locker) external;
        function lockShard(bytes32 shardId) external;
        function unlockShard(bytes32 shardId) external;
        function isLocked(bytes32 shardId) external view returns (bool);
        function seize(bytes32 shardId, address to) external;
    }
}

// ABI bindings for the KeeperStaking contract
sol! {
    #[sol(rpc)]
    interface IKeeperStaking {
        function stake() external payable;
        function requestUnstake() external;
        function unstake() external;
        function claimRewards() external;
        function getKeeperInfo(address keeper) external view returns (uint256 stakedAmount, uint256 unstakeRequestedAt, uint256 rewards, bool isActive);
    }
}

// ABI bindings for the ShardValuation contract
sol! {
    #[sol(rpc)]
    interface IShardValuation {
        function attest(bytes32 shardId, uint256 level, uint256 elo, uint256 statsSum) external;
        function valueShard(bytes32 shardId) external view returns (uint256);
        function hasValidAttestation(bytes32 shardId) external view returns (bool);
    }
}

// ABI bindings for the LoanVault contract
sol! {
    #[sol(rpc)]
    interface ILoanVault {
        function createLoan(bytes32 loanId, bytes32 shardId, uint256 principal, uint256 interestBps, uint256 duration) external;
        function fundLoan(bytes32 loanId) external payable;
        function repayLoan(bytes32 loanId) external payable;
        function liquidate(bytes32 loanId) external;
        function cancelLoan(bytes32 loanId) external;
        function getRepaymentAmount(bytes32 loanId) external view returns (uint256);
        function isExpired(bytes32 loanId) external view returns (bool);
        function isLiquidatable(bytes32 loanId) external view returns (bool);
    }
}

/// Load the keeper's private key signer from the configured key file.
fn load_signer(config: &Config) -> Result<PrivateKeySigner, String> {
    let key_path = shellexpand(config.private_key_path.as_str());
    let key_hex = std::fs::read_to_string(&key_path)
        .map_err(|e| format!("Failed to read private key from {}: {}", key_path, e))?;

    let key_hex = key_hex.trim().trim_start_matches("0x");
    PrivateKeySigner::from_str(key_hex)
        .map_err(|e| format!("Invalid private key: {}", e))
}

/// Create an alloy provider with the configured wallet and RPC URL.
fn make_provider(config: &Config) -> Result<impl alloy::providers::Provider + Clone, String> {
    let signer = load_signer(config)?;
    let wallet = EthereumWallet::from(signer);

    let rpc_url: reqwest::Url = config.rpc_url.parse()
        .map_err(|e| format!("Invalid RPC URL: {}", e))?;

    Ok(ProviderBuilder::new()
        .wallet(wallet)
        .connect_http(rpc_url))
}

/// Create a read-only alloy provider (no wallet needed).
fn make_read_provider(config: &Config) -> Result<impl alloy::providers::Provider + Clone, String> {
    let rpc_url: reqwest::Url = config.rpc_url.parse()
        .map_err(|e| format!("Invalid RPC URL: {}", e))?;

    Ok(ProviderBuilder::new().connect_http(rpc_url))
}

/// Stake ETH to the keeper staking contract.
pub async fn stake(config: &Config, amount_eth: f64) -> Result<String, String> {
    let staking_address = config
        .keeper_staking_address
        .as_ref()
        .ok_or("keeper_staking_address not configured")?;

    let address: Address = staking_address
        .parse()
        .map_err(|e| format!("Invalid staking address: {}", e))?;

    let provider = make_provider(config)?;
    let contract = IKeeperStaking::new(address, &provider);

    // Convert ETH to Wei
    let amount_wei = U256::from((amount_eth * 1e18) as u128);

    let tx = contract
        .stake()
        .value(amount_wei)
        .send()
        .await
        .map_err(|e| format!("Stake transaction failed: {}", e))?;

    let receipt = tx
        .get_receipt()
        .await
        .map_err(|e| format!("Failed to get receipt: {}", e))?;

    Ok(format!("Staked {} ETH. Tx: {:?}", amount_eth, receipt.transaction_hash))
}

/// Request to unstake from the keeper network.
pub async fn unstake(config: &Config) -> Result<String, String> {
    let staking_address = config
        .keeper_staking_address
        .as_ref()
        .ok_or("keeper_staking_address not configured")?;

    let address: Address = staking_address
        .parse()
        .map_err(|e| format!("Invalid staking address: {}", e))?;

    let provider = make_provider(config)?;
    let contract = IKeeperStaking::new(address, &provider);

    let tx = contract
        .requestUnstake()
        .send()
        .await
        .map_err(|e| format!("Unstake request failed: {}", e))?;

    let receipt = tx
        .get_receipt()
        .await
        .map_err(|e| format!("Failed to get receipt: {}", e))?;

    Ok(format!("Unstake requested. Tx: {:?}", receipt.transaction_hash))
}

/// Get keeper info (stake amount, active status, rewards) from the staking contract.
pub async fn get_keeper_info(config: &Config, keeper_address: &str) -> Result<(U256, U256, U256, bool), String> {
    let staking_address = config
        .keeper_staking_address
        .as_ref()
        .ok_or("keeper_staking_address not configured")?;

    let contract_addr: Address = staking_address
        .parse()
        .map_err(|e| format!("Invalid staking address: {}", e))?;

    let keeper_addr: Address = keeper_address
        .parse()
        .map_err(|e| format!("Invalid keeper address: {}", e))?;

    let provider = make_read_provider(config)?;
    let contract = IKeeperStaking::new(contract_addr, &provider);

    let result = contract
        .getKeeperInfo(keeper_addr)
        .call()
        .await
        .map_err(|e| format!("getKeeperInfo call failed: {}", e))?;

    Ok((result.stakedAmount, result.unstakeRequestedAt, result.rewards, result.isActive))
}

/// Register a shard on-chain via the ShardRegistry contract.
pub async fn register_shard(
    config: &Config,
    shard_id: &str,
    genome_hash: &str,
) -> Result<String, String> {
    let registry_address = config
        .shard_registry_address
        .as_ref()
        .ok_or("shard_registry_address not configured")?;

    let address: Address = registry_address
        .parse()
        .map_err(|e| format!("Invalid registry address: {}", e))?;

    let provider = make_provider(config)?;
    let contract = IShardRegistry::new(address, &provider);

    let shard_id_bytes = parse_bytes32(shard_id)?;
    let genome_hash_bytes = parse_bytes32(genome_hash)?;

    let tx = contract
        .register(shard_id_bytes.into(), genome_hash_bytes.into())
        .send()
        .await
        .map_err(|e| format!("Register transaction failed: {}", e))?;

    let receipt = tx
        .get_receipt()
        .await
        .map_err(|e| format!("Failed to get receipt: {}", e))?;

    Ok(format!(
        "Shard registered on-chain. Tx: {:?}",
        receipt.transaction_hash
    ))
}

/// Attest a shard's stats to the ShardValuation contract.
pub async fn attest_shard_value(
    config: &Config,
    genome_hash: &str,
    level: u64,
    elo: u64,
    stats_sum: u64,
) -> Result<String, String> {
    let valuation_address = config
        .shard_valuation_address
        .as_ref()
        .ok_or("shard_valuation_address not configured")?;

    let address: Address = valuation_address
        .parse()
        .map_err(|e| format!("Invalid valuation address: {}", e))?;

    let provider = make_provider(config)?;
    let contract = IShardValuation::new(address, &provider);

    let hash_bytes = parse_bytes32(genome_hash)?;

    let tx = contract
        .attest(
            hash_bytes.into(),
            U256::from(level),
            U256::from(elo),
            U256::from(stats_sum),
        )
        .send()
        .await
        .map_err(|e| format!("Attest transaction failed: {}", e))?;

    let receipt = tx
        .get_receipt()
        .await
        .map_err(|e| format!("Failed to get receipt: {}", e))?;

    Ok(format!(
        "Attested shard value (level={}, elo={}, stats={}). Tx: {:?}",
        level, elo, stats_sum, receipt.transaction_hash
    ))
}

/// Check if a loan is liquidatable via the LoanVault contract.
pub async fn check_liquidatable(config: &Config, loan_id: &str) -> Result<bool, String> {
    let vault_address = config
        .loan_vault_address
        .as_ref()
        .ok_or("loan_vault_address not configured")?;

    let address: Address = vault_address
        .parse()
        .map_err(|e| format!("Invalid vault address: {}", e))?;

    let provider = make_read_provider(config)?;
    let contract = ILoanVault::new(address, &provider);

    let loan_id_bytes = parse_bytes32(loan_id)?;

    let result = contract
        .isLiquidatable(loan_id_bytes.into())
        .call()
        .await
        .map_err(|e| format!("isLiquidatable call failed: {}", e))?;

    Ok(result)
}

/// Liquidate a defaulted loan via the LoanVault contract.
pub async fn liquidate_loan(config: &Config, loan_id: &str) -> Result<String, String> {
    let vault_address = config
        .loan_vault_address
        .as_ref()
        .ok_or("loan_vault_address not configured")?;

    let address: Address = vault_address
        .parse()
        .map_err(|e| format!("Invalid vault address: {}", e))?;

    let provider = make_provider(config)?;
    let contract = ILoanVault::new(address, &provider);

    let loan_id_bytes = parse_bytes32(loan_id)?;

    let tx = contract
        .liquidate(loan_id_bytes.into())
        .send()
        .await
        .map_err(|e| format!("Liquidate transaction failed: {}", e))?;

    let receipt = tx
        .get_receipt()
        .await
        .map_err(|e| format!("Failed to get receipt: {}", e))?;

    Ok(format!("Loan liquidated. Tx: {:?}", receipt.transaction_hash))
}

/// Parse a hex string into a 32-byte array.
fn parse_bytes32(hex_str: &str) -> Result<[u8; 32], String> {
    let hex = hex_str.trim_start_matches("0x");
    let mut bytes = [0u8; 32];
    let decoded = hex_decode(hex)?;
    let len = decoded.len().min(32);
    bytes[..len].copy_from_slice(&decoded[..len]);
    Ok(bytes)
}

/// Simple hex decoding without adding another dependency.
fn hex_decode(hex: &str) -> Result<Vec<u8>, String> {
    if hex.len() % 2 != 0 {
        return Err("Odd-length hex string".to_string());
    }
    (0..hex.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&hex[i..i + 2], 16)
                .map_err(|e| format!("Invalid hex at position {}: {}", i, e))
        })
        .collect()
}

/// Expand ~ to home directory in paths.
fn shellexpand(path: &str) -> String {
    if path.starts_with("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{}{}", home, &path[1..]);
        }
    }
    path.to_string()
}
