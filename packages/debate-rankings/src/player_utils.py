import hashlib

import pandas as pd


def normalize_name(name: str) -> str:
    """Normalizes a debater name to have proper capitalization."""
    parts = []
    for part in name.split():
        if part and part[0].islower():
            part = part[0].upper() + part[1:]
        parts.append(part)
    return " ".join(parts)


def generate_player_id(
    institution: str, full_name: str, multi_team_debaters: list, format: str
) -> str:
    """Generates a unique player ID by hashing the debater's institution and full name together.

    For debaters who compete for multiple teams, only the name is used to ensure
    a unified ranking across all their appearances.
    Names are normalized before hashing for consistency.
    """
    normalized_name = normalize_name(full_name)

    if format == "hsld":
        if normalized_name in multi_team_debaters:
            combined = normalized_name
        else:
            combined = f"{institution}{normalized_name}"
    else:
        name_arr = full_name.split("&")

        clean_name_arr = []

        for name in name_arr:
            clean_name_arr.append(normalize_name(name.strip()))

        clean_name_arr.sort()

        # If this partnership competes under multiple institutions, hash on names only
        sorted_pair = " & ".join(clean_name_arr)
        if sorted_pair in multi_team_debaters:
            combined = "".join(clean_name_arr)
        else:
            combined = f"{institution}{''.join(clean_name_arr)}"

    return hashlib.sha256(combined.encode()).hexdigest()


def sort_entry_names(entry: str, format: str) -> str:
    """Sorts the names in an entry alphabetically for consistent display

    For CPD format, splits by '&' and sorts names.
    For HSLD format, returns the entry as-is.
    Both formats normalize capitalization.
    """
    if format == "hsld":
        return normalize_name(entry)

    name_arr = entry.split("&")
    clean_name_arr = [normalize_name(name.strip()) for name in name_arr]
    clean_name_arr.sort()

    return " & ".join(clean_name_arr)


def create_player_hashes(
    tournament: str, multi_team_debaters: list, format: str
) -> pd.DataFrame:
    """Creates unique hashes for each player based on their institution and entry"""

    entries_file = f"./tournaments/{tournament}/entries.csv"
    teams = pd.read_csv(entries_file, delimiter=",", header=0)
    teams.columns = teams.columns.str.strip()

    teams["hash"] = teams.apply(
        lambda row: generate_player_id(
            row["Institution"], row["Entry"], multi_team_debaters, format
        ),
        axis=1,
    )

    # Sort names in the Entry field for consistent display
    teams["Entry"] = teams.apply(
        lambda row: sort_entry_names(row["Entry"], format),
        axis=1,
    )

    return teams


def parse_debaters_from_tournament(
    tournament: str,
    debaters: pd.DataFrame,
    glicko_model,
    multi_team_debaters: list,
    format: str,
) -> pd.DataFrame:
    """Adds tournament entries to debaters DataFrame and glicko model

    Args:
        tournament: Tournament name
        debaters: DataFrame of existing debaters
        glicko_model: Glicko2 model instance
        multi_team_debaters: List of debaters who compete for multiple teams

    Returns:
        Updated debaters DataFrame
    """
    teams = create_player_hashes(tournament, multi_team_debaters, format)

    file = f"./tournaments/{tournament}/entries.csv"
    teams.to_csv(file, index=False)

    for _, team_row in teams.iterrows():
        hash = team_row["hash"]

        if debaters.empty:
            is_already_in_debaters = False
        else:
            is_already_in_debaters = hash in debaters["hash"].values

        if not is_already_in_debaters:
            debaters = pd.concat([debaters, team_row.to_frame().T], ignore_index=True)
            glicko_model.add(hash)

    return debaters
