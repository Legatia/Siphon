use sysinfo::System;

/// System resource statistics for the keeper node.
pub struct SystemStats {
    /// CPU usage as a percentage (0.0 - 100.0)
    pub cpu_usage: f64,
    /// Used memory in megabytes
    pub memory_used_mb: f64,
    /// Total memory in megabytes
    pub memory_total_mb: f64,
    /// Free disk space in gigabytes
    pub disk_free_gb: f64,
    /// System uptime in seconds
    pub uptime_secs: u64,
}

/// Collect current system resource statistics.
///
/// Uses the `sysinfo` crate to read CPU usage, memory consumption,
/// disk space, and system uptime.
pub fn get_system_stats() -> SystemStats {
    let mut sys = System::new_all();
    sys.refresh_all();

    // CPU usage: average across all CPUs
    let cpu_usage = if sys.cpus().is_empty() {
        0.0
    } else {
        let total: f32 = sys.cpus().iter().map(|cpu| cpu.cpu_usage()).sum();
        (total / sys.cpus().len() as f32) as f64
    };

    // Memory in MB
    let memory_total_mb = sys.total_memory() as f64 / (1024.0 * 1024.0);
    let memory_used_mb = sys.used_memory() as f64 / (1024.0 * 1024.0);

    // Disk free space in GB (sum across all disks)
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let disk_free_gb: f64 = disks
        .iter()
        .map(|d| d.available_space() as f64 / (1024.0 * 1024.0 * 1024.0))
        .sum();

    // System uptime
    let uptime_secs = System::uptime();

    SystemStats {
        cpu_usage,
        memory_used_mb,
        memory_total_mb,
        disk_free_gb,
        uptime_secs,
    }
}

/// Format system stats as a human-readable string for logging.
pub fn format_stats(stats: &SystemStats) -> String {
    format!(
        "CPU: {:.1}% | RAM: {:.0}/{:.0} MB | Disk free: {:.1} GB | Uptime: {}",
        stats.cpu_usage,
        stats.memory_used_mb,
        stats.memory_total_mb,
        stats.disk_free_gb,
        format_duration(stats.uptime_secs)
    )
}

/// Format seconds into a human-readable duration string.
fn format_duration(secs: u64) -> String {
    let days = secs / 86400;
    let hours = (secs % 86400) / 3600;
    let minutes = (secs % 3600) / 60;

    if days > 0 {
        format!("{}d {}h {}m", days, hours, minutes)
    } else if hours > 0 {
        format!("{}h {}m", hours, minutes)
    } else {
        format!("{}m {}s", minutes, secs % 60)
    }
}
