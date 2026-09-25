import sys

import pandas as pd
from skelo.model.glicko2 import Glicko2Model


def main():
    # Check command line arguments
    if len(sys.argv) != 3:
        print("Usage: python simulate_round.py <debater_1_name> <debater_2_name>")
        sys.exit(1)

    debater_1 = sys.argv[1]
    debater_2 = sys.argv[2]

    # Load rankings data
    ranking_file = "./output/hsld_full_rankings.csv"
    ranking_data = pd.read_csv(ranking_file)

    # Look up debater 1
    debater_1_row = ranking_data[ranking_data["Name"] == debater_1]
    if debater_1_row.empty:
        print(f"Error: Debater '{debater_1}' not found in rankings.")
        sys.exit(1)

    # Look up debater 2
    debater_2_row = ranking_data[ranking_data["Name"] == debater_2]
    if debater_2_row.empty:
        print(f"Error: Debater '{debater_2}' not found in rankings.")
        sys.exit(1)

    # Extract rating data (mu, phi, sigma)
    debater_1_rating = debater_1_row.iloc[0]["Rating"]
    debater_1_deviation = debater_1_row.iloc[0]["Deviation"]
    debater_1_school = debater_1_row.iloc[0]["School"]

    debater_2_rating = debater_2_row.iloc[0]["Rating"]
    debater_2_deviation = debater_2_row.iloc[0]["Deviation"]
    debater_2_school = debater_2_row.iloc[0]["School"]

    # Initialize Glicko2 model and compute win probability
    model = Glicko2Model()

    # compute_prob expects rating tuples (mu, phi)
    debater_1_win_prob = model.compute_prob(
        (debater_1_rating, debater_1_deviation), (debater_2_rating, debater_2_deviation)
    )
    debater_2_win_prob = 1 - debater_1_win_prob

    # Display results
    print("\n" + "=" * 60)
    print("MATCH SIMULATION")
    print("-" * 60)
    print(f"\n{debater_1} ({debater_1_school})")
    print(f"  Rating: {debater_1_rating:.2f}")
    print(f"  Deviation: {debater_1_deviation:.2f}")
    print(f"\nvs\n")
    print(f"{debater_2} ({debater_2_school})")
    print(f"  Rating: {debater_2_rating:.2f}")
    print(f"  Deviation: {debater_2_deviation:.2f}")
    print(f"\n" + "-" * 60)
    print(f"Win Probabilities:")
    print(f"  {debater_1}: {debater_1_win_prob:.2%}")
    print(f"  {debater_2}: {debater_2_win_prob:.2%}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
