export type DeadlineType =
  | "minutes_before_kickoff"
  | "minutes_after_kickoff"
  | "fixed_time_of_day"
  | "fixed_datetime";

export type Match = {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  deadline_type: DeadlineType;
  deadline_value: string;
  // When submissions open. Null = open immediately (legacy fixtures).
  submission_open: string | null;
  submission_deadline: string;
  home_score: number | null;
  away_score: number | null;
  // In-play data from the results sync (display-only; cleared meaning once
  // home_score/away_score land). live_status is Livescore's clock/status
  // string: "23'", "45+2'", "HT", …
  live_home_score: number | null;
  live_away_score: number | null;
  live_status: string | null;
};

export type Prediction = {
  id: string;
  user_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  points: number | null;
};

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  total_points: number;
  scored_matches: number;
  exact_hits: number;
  outcome_hits: number;
};

export type League = {
  id: string;
  name: string;
  join_code: string;
  created_by: string | null;
  created_at: string;
  points_exact: number;
  points_outcome: number;
  submission_mode: "single" | "multiple";
  is_global: boolean;
  // Ordered prize list: index i is the prize for place i+1 (display-only).
  // Optional: only loaded on the detail/manage views, not in summary lists.
  prizes?: string[];
};

// A league plus its member count, as shown in lists.
export type LeagueSummary = League & { member_count: number };

// The single app_settings row (white-label config + scoring rules).
export type AppSettings = {
  tournament_timezone: string;
  points_exact: number;
  points_outcome: number;
  submission_mode: "single" | "multiple";
  // Platform-wide deadline policy applied to every match.
  deadline_type: "minutes_before_kickoff" | "minutes_after_kickoff";
  deadline_value: string;
  brand_name: string;
  brand_tagline: string;
  login_headline: string;
  login_subtitle: string;
  theme: "dark" | "light";
  accent: string;
};
