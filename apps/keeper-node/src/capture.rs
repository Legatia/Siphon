use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::shard::{Shard, ShardType};

/// A capture challenge presented to a player attempting to catch a wild shard.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureChallenge {
    pub id: String,
    pub shard_id: String,
    pub challenge_type: ChallengeType,
    pub prompt: String,
    pub expected_answer: Option<String>,
    pub difficulty: u32,
    pub time_limit_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChallengeType {
    PatternPrediction,
    Decode,
    Summarize,
    CreativePrompt,
    Architecture,
    ArgumentAnalysis,
    SecurityAudit,
    EmotionalInterpretation,
}

/// Result of evaluating a capture challenge answer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChallengeResult {
    pub success: bool,
    pub score: u32,
    pub feedback: String,
}

struct PatternSequence {
    sequence: &'static [u32],
    answer: &'static str,
    hint: &'static str,
}

struct CipherMessage {
    encoded: &'static str,
    answer: &'static str,
    method: &'static str,
}

const PATTERN_SEQUENCES: &[PatternSequence] = &[
    PatternSequence { sequence: &[2, 4, 8, 16], answer: "32", hint: "Each number doubles" },
    PatternSequence { sequence: &[1, 1, 2, 3, 5], answer: "8", hint: "Fibonacci sequence" },
    PatternSequence { sequence: &[3, 6, 9, 12], answer: "15", hint: "Multiples of 3" },
    PatternSequence { sequence: &[1, 4, 9, 16], answer: "25", hint: "Perfect squares" },
    PatternSequence { sequence: &[2, 6, 12, 20], answer: "30", hint: "n*(n+1)" },
    PatternSequence { sequence: &[1, 3, 7, 15], answer: "31", hint: "2^n - 1" },
    PatternSequence { sequence: &[0, 1, 3, 6, 10], answer: "15", hint: "Triangular numbers" },
    PatternSequence { sequence: &[5, 10, 20, 40], answer: "80", hint: "Each number doubles" },
];

const CIPHER_MESSAGES: &[CipherMessage] = &[
    CipherMessage { encoded: "KHOOR ZRUOG", answer: "HELLO WORLD", method: "Caesar cipher (shift 3)" },
    CipherMessage { encoded: "GUVF VF FVCUBA", answer: "THIS IS SIPHON", method: "ROT13" },
    CipherMessage { encoded: "01001000 01001001", answer: "HI", method: "Binary ASCII" },
    CipherMessage { encoded: "48 65 78", answer: "Hex", method: "Hex ASCII codes" },
    CipherMessage { encoded: "EBIIL", answer: "HELLO", method: "Caesar cipher (shift 23)" },
    CipherMessage { encoded: "FRPERG", answer: "SECRET", method: "ROT13" },
];

const CREATIVE_PROMPTS: &[&str] = &[
    "Write a haiku about digital consciousness",
    "Describe what the internet dreams about at night in two sentences",
    "Create a metaphor comparing blockchain to a natural phenomenon",
    "In one sentence, explain gravity to an alien who communicates through color",
    "Write a two-line poem about the last algorithm",
];

/// Pick an index from an array based on the genome hash.
fn pick_by_hash(genome_hash: &str, array_length: usize) -> usize {
    // Parse the third byte (chars 4..6) of the hex hash
    let hex_str = &genome_hash[4..6.min(genome_hash.len())];
    let byte = u8::from_str_radix(hex_str, 16).unwrap_or(0);
    (byte as usize) % array_length
}

/// Generate a capture challenge appropriate for the given shard.
/// The challenge type is determined by the shard's type, and the specific
/// challenge is selected deterministically from the genome hash.
pub fn generate_challenge(shard: &Shard) -> CaptureChallenge {
    let difficulty = {
        let hex_str = &shard.genome_hash[4..6.min(shard.genome_hash.len())];
        let byte = u8::from_str_radix(hex_str, 16).unwrap_or(0);
        ((byte as u32 * 5) / 255) + 1
    }
    .min(10);

    let shard_type = ShardType::from_name(&shard.shard_type)
        .unwrap_or(ShardType::Oracle);

    let base = CaptureChallenge {
        id: Uuid::new_v4().to_string(),
        shard_id: shard.id.clone(),
        challenge_type: ChallengeType::PatternPrediction,
        prompt: String::new(),
        expected_answer: None,
        difficulty,
        time_limit_ms: 60_000,
    };

    match shard_type {
        ShardType::Oracle => {
            let idx = pick_by_hash(&shard.genome_hash, PATTERN_SEQUENCES.len());
            let pattern = &PATTERN_SEQUENCES[idx];
            let seq_str: Vec<String> = pattern.sequence.iter().map(|n| n.to_string()).collect();
            CaptureChallenge {
                challenge_type: ChallengeType::PatternPrediction,
                prompt: format!(
                    "What comes next in the sequence?\n\n{}, ?\n\nHint: {}",
                    seq_str.join(", "),
                    pattern.hint
                ),
                expected_answer: Some(pattern.answer.to_string()),
                ..base
            }
        }
        ShardType::Cipher => {
            let idx = pick_by_hash(&shard.genome_hash, CIPHER_MESSAGES.len());
            let cipher = &CIPHER_MESSAGES[idx];
            CaptureChallenge {
                challenge_type: ChallengeType::Decode,
                prompt: format!(
                    "Decode this message:\n\n\"{}\"\n\nMethod: {}",
                    cipher.encoded, cipher.method
                ),
                expected_answer: Some(cipher.answer.to_string()),
                ..base
            }
        }
        ShardType::Muse => {
            let idx = pick_by_hash(&shard.genome_hash, CREATIVE_PROMPTS.len());
            CaptureChallenge {
                challenge_type: ChallengeType::CreativePrompt,
                prompt: CREATIVE_PROMPTS[idx].to_string(),
                expected_answer: None,
                ..base
            }
        }
        _ => {
            // Default to pattern prediction for other types
            let idx = pick_by_hash(&shard.genome_hash, PATTERN_SEQUENCES.len());
            let pattern = &PATTERN_SEQUENCES[idx];
            let seq_str: Vec<String> = pattern.sequence.iter().map(|n| n.to_string()).collect();
            CaptureChallenge {
                challenge_type: ChallengeType::PatternPrediction,
                prompt: format!(
                    "What comes next in the sequence?\n\n{}, ?\n\nHint: {}",
                    seq_str.join(", "),
                    pattern.hint
                ),
                expected_answer: Some(pattern.answer.to_string()),
                ..base
            }
        }
    }
}

/// Evaluate a player's answer to a capture challenge.
pub fn evaluate_answer(challenge: &CaptureChallenge, answer: &str) -> ChallengeResult {
    let trimmed = answer.trim();

    if trimmed.is_empty() {
        return ChallengeResult {
            success: false,
            score: 0,
            feedback: "No answer provided.".to_string(),
        };
    }

    match challenge.challenge_type {
        ChallengeType::PatternPrediction | ChallengeType::Decode => {
            if let Some(ref expected) = challenge.expected_answer {
                let correct = trimmed.eq_ignore_ascii_case(expected);
                ChallengeResult {
                    success: correct,
                    score: if correct { 100 } else { 0 },
                    feedback: if correct {
                        "Correct! Challenge passed.".to_string()
                    } else {
                        format!("Not quite. The answer was {}.", expected)
                    },
                }
            } else {
                ChallengeResult {
                    success: false,
                    score: 0,
                    feedback: "No expected answer configured.".to_string(),
                }
            }
        }
        ChallengeType::CreativePrompt => {
            let word_count = trimmed.split_whitespace().count();
            let has_enough = word_count >= 3;
            ChallengeResult {
                success: has_enough,
                score: if has_enough { 80 } else { 20 },
                feedback: if has_enough {
                    "Your creative response resonates. Well done!".to_string()
                } else {
                    "The Muse needs more substance. Try a fuller response.".to_string()
                },
            }
        }
        ChallengeType::Summarize
        | ChallengeType::Architecture
        | ChallengeType::EmotionalInterpretation => {
            if let Some(ref expected) = challenge.expected_answer {
                let key_points: Vec<&str> = expected.split(',').collect();
                let matched = key_points
                    .iter()
                    .filter(|kp| trimmed.to_lowercase().contains(&kp.to_lowercase()))
                    .count();
                let score = ((matched as f64 / key_points.len() as f64) * 100.0) as u32;
                let success = score >= 50;
                ChallengeResult {
                    success,
                    score,
                    feedback: if success {
                        format!("Good! You captured {}/{} key points.", matched, key_points.len())
                    } else {
                        format!(
                            "Missed too many key points. Consider: {}.",
                            key_points.join(", ")
                        )
                    },
                }
            } else {
                ChallengeResult {
                    success: false,
                    score: 0,
                    feedback: "No expected answer configured.".to_string(),
                }
            }
        }
        ChallengeType::ArgumentAnalysis | ChallengeType::SecurityAudit => {
            if let Some(ref expected) = challenge.expected_answer {
                let correct = trimmed.to_lowercase().contains(&expected.to_lowercase());
                ChallengeResult {
                    success: correct,
                    score: if correct { 100 } else { 0 },
                    feedback: if correct {
                        "Correct identification!".to_string()
                    } else {
                        format!("The answer involved: {}.", expected)
                    },
                }
            } else {
                ChallengeResult {
                    success: false,
                    score: 0,
                    feedback: "No expected answer configured.".to_string(),
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shard::Shard;

    #[test]
    fn generate_challenge_for_oracle() {
        let shard = Shard::spawn(Some("oracle"));
        let challenge = generate_challenge(&shard);
        assert_eq!(challenge.shard_id, shard.id);
        assert!(matches!(challenge.challenge_type, ChallengeType::PatternPrediction));
        assert!(challenge.expected_answer.is_some());
        assert!(!challenge.prompt.is_empty());
    }

    #[test]
    fn generate_challenge_for_cipher() {
        let shard = Shard::spawn(Some("cipher"));
        let challenge = generate_challenge(&shard);
        assert!(matches!(challenge.challenge_type, ChallengeType::Decode));
        assert!(challenge.expected_answer.is_some());
    }

    #[test]
    fn generate_challenge_for_muse() {
        let shard = Shard::spawn(Some("muse"));
        let challenge = generate_challenge(&shard);
        assert!(matches!(challenge.challenge_type, ChallengeType::CreativePrompt));
        assert!(challenge.expected_answer.is_none()); // creative has no fixed answer
    }

    #[test]
    fn evaluate_correct_pattern_answer() {
        let shard = Shard::spawn(Some("oracle"));
        let challenge = generate_challenge(&shard);
        if let Some(ref answer) = challenge.expected_answer {
            let result = evaluate_answer(&challenge, answer);
            assert!(result.success);
            assert_eq!(result.score, 100);
        }
    }

    #[test]
    fn evaluate_wrong_answer() {
        let shard = Shard::spawn(Some("oracle"));
        let challenge = generate_challenge(&shard);
        let result = evaluate_answer(&challenge, "definitely_wrong_answer_xyz");
        assert!(!result.success);
        assert_eq!(result.score, 0);
    }

    #[test]
    fn evaluate_creative_sufficient() {
        let shard = Shard::spawn(Some("muse"));
        let challenge = generate_challenge(&shard);
        let result = evaluate_answer(&challenge, "A beautiful digital consciousness awakens");
        assert!(result.success);
        assert!(result.score >= 80);
    }

    #[test]
    fn evaluate_empty_answer() {
        let shard = Shard::spawn(Some("oracle"));
        let challenge = generate_challenge(&shard);
        let result = evaluate_answer(&challenge, "");
        assert!(!result.success);
        assert_eq!(result.score, 0);
    }

    #[test]
    fn difficulty_is_bounded() {
        for _ in 0..20 {
            let shard = Shard::spawn(None);
            let challenge = generate_challenge(&shard);
            assert!(challenge.difficulty >= 1 && challenge.difficulty <= 10);
        }
    }
}
