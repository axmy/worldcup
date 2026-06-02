export type DeadlineType = "minutes_before_kickoff" | "fixed_time_of_day";

export type Match = {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  deadline_type: DeadlineType;
  deadline_value: string;
  submission_deadline: string;
  home_score: number | null;
  away_score: number | null;
};

export type Prediction = {
  id: string;
  user_id: string;
  league_id: string;
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
};

export type League = {
  id: string;
  name: string;
  join_code: string;
  created_by: string | null;
  created_at: string;
};

// A league plus its member count, as shown in lists.
export type LeagueSummary = League & { member_count: number };
