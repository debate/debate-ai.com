-- Adds the long team-name columns the video seed now writes (`VideoRow`'s
-- `affTeamLong` / `negTeamLong`: debaters' last names, lowercased and
-- hyphen-joined, e.g. "gallow-stern"). Without them every seed run fails with
-- "table videos has no column named aff_team_long". Both stay null until the
-- rankings lookup resolves a team.
ALTER TABLE videos ADD COLUMN aff_team_long text;
ALTER TABLE videos ADD COLUMN neg_team_long text;
