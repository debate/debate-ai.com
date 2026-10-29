def determine_weight(tournament_name: str, majors: list) -> int:
    """Determines weight of round based on tournament importance

    Args:
        tournament_name: Name of the tournament
        majors: List of major tournament names

    Returns:
        Weight multiplier (2 for majors, 1 for regular tournaments)
    """
    if tournament_name in majors:
        return 2
    else:
        return 1
