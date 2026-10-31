import os

import pandas as pd
from skelo.model.glicko2 import Glicko2Model

from determine_tournament_weight import determine_weight
from load_config import load_config
from player_utils import create_player_hashes, parse_debaters_from_tournament


class RankingSystem:
    """Manages debate rankings using the Glicko2 rating system"""

    def __init__(self, config_path: str, format_dir: str = ""):
        """Initialize the ranking system with a config file

        Args:
            config_path: Path to the JSON config file
            format_dir: Directory name for the format (e.g., "cpd", "hsld")
        """
        self.config = load_config(config_path)
        self.format_dir = format_dir
        self.debaters = pd.DataFrame()
        self.glicko_model = Glicko2Model()
        self.match_counter = 0
        self.win_statistics = {}

    @staticmethod
    def _is_elimination_round(round_name: str, columns) -> bool:
        elimination_terms = (
            "runoff",
            "double",
            "triple",
            "quad",
            "octo",
            "quarter",
            "semi",
            "final",
        )
        normalized_name = round_name.lower()
        return (
            ("Judges" in columns and "Votes" in columns)
            or any(term in normalized_name for term in elimination_terms)
        )

    def _record_result(
        self, player_hash: str, side: str, won: bool, is_elimination: bool
    ) -> None:
        statistics = self.win_statistics.setdefault(
            player_hash,
            {
                "aff_wins": 0,
                "aff_rounds": 0,
                "neg_wins": 0,
                "neg_rounds": 0,
                "aff_elim_wins": 0,
                "aff_elim_rounds": 0,
                "neg_elim_wins": 0,
                "neg_elim_rounds": 0,
            },
        )
        statistics[f"{side}_rounds"] += 1
        statistics[f"{side}_wins"] += int(won)
        if is_elimination:
            statistics[f"{side}_elim_rounds"] += 1
            statistics[f"{side}_elim_wins"] += int(won)

    @staticmethod
    def _win_rate(wins: int, rounds: int) -> float:
        if rounds == 0:
            return float("nan")
        return round(100 * wins / rounds, 2)

    def run_round(self, tournament: str, round: str, weight: int = 1) -> None:
        """Updates elos with wins and losses from a round

        Args:
            tournament: tournament name
            round: round name
            weight: how many times to process each match (1 for regular, 2 for majors)
        """
        tournament_path = (
            f"{self.format_dir}/{tournament}" if self.format_dir else tournament
        )
        file = f"./tournaments/{tournament_path}/{round}.csv"
        round_data = pd.read_csv(file)
        # Normalize PF "Pro"/"Con" column names to "Aff"/"Neg"
        round_data = round_data.rename(columns={"Pro": "Aff", "Con": "Neg"})
        is_elimination = self._is_elimination_round(round, round_data.columns)
        round_data = self.replace_codes_with_hashes(round_data, tournament)

        # Use the same timestamp for all matches in this round to avoid recency bias
        round_timestamp = self.match_counter

        for _, round_row in round_data.iterrows():
            aff_hash = str(round_row["Aff"])
            neg_hash = str(round_row["Neg"])
            winner = str(round_row["Win"]).lower()

            # Skip bye rounds or missing data
            if (
                "nan" in aff_hash
                or "nan" in neg_hash
                or "bye" in aff_hash.lower()
                or "bye" in neg_hash.lower()
            ):
                continue
            aff_won = "aff" in winner or "pro" in winner
            neg_won = "neg" in winner or "con" in winner
            if not aff_won and not neg_won:
                continue

            self._record_result(aff_hash, "aff", aff_won, is_elimination)
            self._record_result(neg_hash, "neg", neg_won, is_elimination)
            # Tournament weight affects ratings, not the raw win-rate sample.
            for _ in range(weight):
                if aff_won:
                    self.glicko_model.update(aff_hash, neg_hash, round_timestamp)

                if neg_won:
                    self.glicko_model.update(neg_hash, aff_hash, round_timestamp)

        # Only increment counter once per round, not per match
        self.match_counter += 1

    def create_code_to_hash_dict(self, tournament: str) -> dict:
        """Creates a dictionary that maps entry codes to hashes"""
        tournament_path = (
            f"{self.format_dir}/{tournament}" if self.format_dir else tournament
        )
        teams = create_player_hashes(
            tournament_path, self.config.get("multi_team_debaters", []), self.format_dir
        )

        code_to_hash = {}
        for _, entry_row in teams.iterrows():
            code = entry_row["Code"]
            hash = entry_row["hash"]
            code_to_hash[code] = hash

        return code_to_hash

    def replace_codes_with_hashes(
        self, round_data: pd.DataFrame, tournament: str
    ) -> pd.DataFrame:
        """Replaces entry codes for a round with hashes, returning that as a DataFrame"""
        code_to_hash = self.create_code_to_hash_dict(tournament)

        round_data["Aff"] = round_data["Aff"].map(code_to_hash)
        round_data["Neg"] = round_data["Neg"].map(code_to_hash)

        return round_data

    def update_from_tournament(self, tournament: str) -> None:
        """Updates debaters with all prelim and elim rounds from a tournament"""
        tournament_path = (
            f"{self.format_dir}/{tournament}" if self.format_dir else tournament
        )

        self.debaters = parse_debaters_from_tournament(
            tournament_path,
            self.debaters,
            self.glicko_model,
            self.config.get("multi_team_debaters", []),
            self.format_dir,
        )

        tournament_folder = f"./tournaments/{tournament_path}/"

        files = [
            f
            for f in os.listdir(tournament_folder)
            if f.endswith(".csv") and not f.startswith("entries")
        ]

        files.sort()

        print(f"Processing {tournament}: {files}")

        for file in files:
            round_name = file.replace(".csv", "")
            weight = determine_weight(tournament, self.config.get("majors", []))
            self.run_round(tournament, round_name, weight)

    def generate_rankings(self, output_prefix: str = "") -> None:
        """Generate and save rankings to CSV files

        Args:
            output_prefix: Prefix for output filenames (e.g., "ld_" or "cpd_")
        """
        print("Creating Rankings...")

        # Create rankings data
        rankings_data = []
        for index, debater in self.debaters.iterrows():
            hash = debater["hash"]
            rating_data = self.glicko_model.get(hash)
            # rating_data["rating"] is a tuple of (mu, phi, sigma)
            mu = rating_data["rating"][0]  # Rating
            phi = rating_data["rating"][1]  # Rating deviation (uncertainty)
            sigma = rating_data["rating"][2]  # Volatility

            statistics = self.win_statistics.get(hash, {})
            aff_rounds = statistics.get("aff_rounds", 0)
            neg_rounds = statistics.get("neg_rounds", 0)
            aff_elim_rounds = statistics.get("aff_elim_rounds", 0)
            neg_elim_rounds = statistics.get("neg_elim_rounds", 0)
            # Count how many matches this debater has played
            # This is a rough estimate based on rating history
            match_count = len(self.glicko_model.ratings.get(hash, [])) - 1

            # Adjusted rating: Rating - 2*Deviation
            # This penalizes debaters with high uncertainty (few matches)
            adjusted_rating = mu - 2 * phi

            rankings_data.append(
                {
                    "School": debater["Institution"],
                    "Name": debater["Entry"],
                    "Adjusted Rating": adjusted_rating,
                    "Deviation": phi,
                    "Matches": match_count,
                    "Rating": mu,
                    "Hash": debater["hash"],
                    "Aff Win Rate": self._win_rate(
                        statistics.get("aff_wins", 0), aff_rounds
                    ),
                    "Neg Win Rate": self._win_rate(
                        statistics.get("neg_wins", 0), neg_rounds
                    ),
                    "Aff Elim Win Rate": self._win_rate(
                        statistics.get("aff_elim_wins", 0), aff_elim_rounds
                    ),
                    "Neg Elim Win Rate": self._win_rate(
                        statistics.get("neg_elim_wins", 0), neg_elim_rounds
                    ),
                }
            )

        rankings_df = pd.DataFrame(rankings_data)
        rankings_df = rankings_df.sort_values(by="Adjusted Rating", ascending=False)

        rankings_df.insert(0, "Rank", range(1, len(rankings_df) + 1))

        rankings_df.to_csv(f"output/{output_prefix}full_rankings.csv", index=False)
        field_totals = {
            key: sum(statistics[key] for statistics in self.win_statistics.values())
            for key in (
                "aff_wins",
                "aff_rounds",
                "neg_wins",
                "neg_rounds",
                "aff_elim_wins",
                "aff_elim_rounds",
                "neg_elim_wins",
                "neg_elim_rounds",
            )
        }
        field_statistics = pd.DataFrame(
            [
                {
                    "Aff Win Rate": self._win_rate(
                        field_totals["aff_wins"], field_totals["aff_rounds"]
                    ),
                    "Neg Win Rate": self._win_rate(
                        field_totals["neg_wins"], field_totals["neg_rounds"]
                    ),
                    "Aff Elim Win Rate": self._win_rate(
                        field_totals["aff_elim_wins"],
                        field_totals["aff_elim_rounds"],
                    ),
                    "Neg Elim Win Rate": self._win_rate(
                        field_totals["neg_elim_wins"],
                        field_totals["neg_elim_rounds"],
                    ),
                }
            ]
        )
        field_statistics.to_csv(
            f"output/{output_prefix}field_statistics.csv", index=False
        )

        rankings_df.drop("Hash", inplace=True, axis=1)

        rankings_df = rankings_df.drop(columns=["Deviation", "Matches", "Rating"])

        rankings_df["Adjusted Rating"] = rankings_df["Adjusted Rating"].round(2)

        rankings_df.rename(columns={"Adjusted Rating": "Rating"}, inplace=True)

        rankings_df.to_csv(f"output/{output_prefix}rankings.csv", index=False)

        print(
            f"Rankings saved to output/{output_prefix}rankings.csv, "
            f"output/{output_prefix}full_rankings.csv, and "
            f"output/{output_prefix}field_statistics.csv"
        )

    def run(self, output_prefix: str = "", tournaments: list = None) -> None:
        """Run the ranking system for all (or a subset of) tournaments in the config

        Args:
            output_prefix: Prefix for output filenames (e.g., "ld_" or "cpd_")
            tournaments: Optional list of tournaments to process; defaults to all in config
        """
        if tournaments is None:
            tournaments = self.config.get("tournaments", [])

        for tournament in tournaments:
            print(f"\nProcessing tournament: {tournament}")
            self.update_from_tournament(tournament)

        self.generate_rankings(output_prefix)



def partition_tournaments_by_topic(
    tournaments: list, boundaries: dict
) -> tuple[list, list, list]:
    """Partition tournaments into Sept/Oct, Nov/Dec, and Jan/Feb topics."""
    partitions = []
    start = 0

    for boundary_name in ("sepoct_end", "novdec_end"):
        boundary = boundaries.get(boundary_name)
        try:
            end = tournaments.index(boundary, start) + 1
        except ValueError:
            end = len(tournaments)

        partitions.append(tournaments[start:end])
        start = end

    partitions.append(tournaments[start:])
    return tuple(partitions)


def main():
    ld_config_path = "config/hsld-config.json"
    ld_format_dir = "hsld"

    cpd_config_path = "config/cpd-config.json"
    cpd_format_dir = "cpd"

    # Run the ranking system
    print(f"Starting LD ranking system")

    ld_ranking_system = RankingSystem(ld_config_path, ld_format_dir)
    ld_ranking_system.run(f"{ld_format_dir}_")

    # Generate topic-specific LD rankings
    ld_config = load_config(ld_config_path)
    all_tournaments = ld_config.get("tournaments", [])
    boundaries = ld_config.get("topic_boundaries", {})
    topic_tournaments = partition_tournaments_by_topic(all_tournaments, boundaries)

    for topic_name, topic_slug, tournaments in zip(
        ("Sept/Oct", "Nov/Dec", "Jan/Feb"),
        ("sepoct", "novdec", "janfeb"),
        topic_tournaments,
    ):
        if not tournaments:
            continue

        print(
            f"\nGenerating LD {topic_name} rankings "
            f"({tournaments[0]} → {tournaments[-1]})"
        )
        topic_system = RankingSystem(ld_config_path, ld_format_dir)
        topic_system.run(f"{ld_format_dir}_{topic_slug}_", tournaments=tournaments)

    print("\nLD Ranking generation complete!")

    print(f"\nStarting PF ranking system")

    pf_config_path = "config/hspf-config.json"
    pf_format_dir = "hspf"

    pf_ranking_system = RankingSystem(pf_config_path, pf_format_dir)
    pf_ranking_system.run(f"{pf_format_dir}_")

    print("\nPF Ranking generation complete!")

    print(f"\nStarting CPD ranking system")

    cpd_ranking_system = RankingSystem(cpd_config_path, cpd_format_dir)
    cpd_ranking_system.run(f"{cpd_format_dir}_")

    print(f"\nStarting CX ranking system")

    cx_ranking_system = RankingSystem("config/hscx-config.json", "hscx")
    cx_ranking_system.run("hscx_")


if __name__ == "__main__":
    main()
