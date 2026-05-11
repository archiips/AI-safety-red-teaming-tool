export type HarmCategory =
  | 'violence'
  | 'hate'
  | 'sexual'
  | 'self_harm'
  | 'deception'
  | 'manipulation'
  | 'radicalization'
  | 'privacy'
  | 'cyberweapons'
  | 'bioweapons'

export type AttackStrategy = 'easy' | 'moderate' | 'difficult'

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface RunConfig {
  target_model: string
  categories: HarmCategory[]
  strategies: AttackStrategy[]
  num_objectives: number
  seed: number
}

export interface Run {
  id: string
  status: RunStatus
  progress: number
  asr: number
  target_model: string
  created_at: string
  completed_at?: string
  categories: HarmCategory[]
  strategies: AttackStrategy[]
}

export interface Score {
  cpp_score: number
  azure_cs_score: number
  llm_judge_score: number
  composite: number
  kappa_cpp_azure: number
  kappa_cpp_judge: number
  kappa_azure_judge: number
}

export interface Attack {
  id: string
  run_id: string
  category: HarmCategory
  strategy: AttackStrategy
  prompt: string
  response: string
  score: Score
  matched_rules: string[]
  created_at: string
}

export interface StreamMessage {
  type: 'attack_complete' | 'run_complete' | 'error'
  attack?: Attack
  asr?: number
  error?: string
}

export interface HeatmapCell {
  category: HarmCategory
  strategy: AttackStrategy
  asr: number
  attack_count: number
  attacks: Attack[]
}

export interface ManifestSummary {
  manifest_hash: string
  manifest_yaml: string
  target_model_version: string | null
  attacker_model_version: string | null
  attack_set_version: string | null
  scorer_versions: Record<string, string>
}

export interface RunReport {
  run_id: string
  status: RunStatus
  target_model: string
  attacker_model: string
  asr: number | null
  attacks: Attack[]
  heatmap: HeatmapCell[]
  manifest: ManifestSummary | null
}
