---
title: "Tabbing"
slug: tabbing
---

The "Tabbing" menu is where you manually enter ballots and sweepstakes
points, as well as keep tabs on the status of each event.

If you are using online ballots for an event, you may not use the
Tabbing menu as extensively - most information, such as which rounds are
still waiting on a ballot, is also available directly on the schematic.

## Entering Ballots

### Manual Ballot Entry

<img src="/screenshots/tabs_tabbing_enterballots.png"
title="tabs_tabbing_enterballots.png" />

Manually entering ballots is done with the "Enter Ballots" menu option.
The sidebar will show you which events have outstanding ballots and
which are fully entered and ready to pair the next round:

<img src="/screenshots/tabbing_entry_index-pending.png"
title="tabbing_entry_index-pending.png" width="300" />

To enter ballots, first select a judge group, timeslot, and event on the
sidebar:

<img src="/screenshots/tabbing_entry_index-judgegroup.png"
title="tabbing_entry_index-judgegroup.png" width="300" />

You will then be shown a list of ballots, sorted by judge code/name,
depending on your event settings. The "Entry" tab contains outstanding
ballots - once they are entered, they will appear on the "Done" tab
instead. If you have "double enter" set as your ballot entry method,
then ballots which have only been entered once will be shown in yellow:

<img src="/screenshots/tabbing_entry_index-entry.png"
title="tabbing_entry_index-entry.png" width="300" />

To enter a ballot, click on the judge code/name. You will then be shown
the ballot entry screen:

<img src="/screenshots/tabbing_entry_index-debate.png"
title="tabbing_entry_index-debate.png" width="500" />

<img src="/screenshots/tabbing_entry_index-speech.png"
title="tabbing_entry_index-speech.png" width="500" />

Enter the points/ranks/winner from the ballot, and click "Save Scores."
If you have "double enter" turned on, you will then be prompted to give
the ballot to someone else to enter again.

**Important Note** - Make sure to read the "Hints & Shortcuts" section
below the ballot you are entering. The keyboard shortcuts to use to
enter points and/or a winner depends on the point "step" you have
selected in the Event settings, such as full points, half points, or
tenth points. For example, with tenth points selected, you type only the
last two digits - so a "28.2" should be typed as an "82." If the points
you enter keep getting changed automatically to something else, it's
because you're using the wrong keyboard shortcuts to enter them.

If your ballot entry method is set to "visual scan" instead of double
entry, you will see a tab on the sidebar for "Audit:"

<img src="/screenshots/tabbing_entry_audit-tab.png"
title="tabbing_entry_audit-tab.png" width="300" />

This will show you what you entered for the ballot the first time, and
ask you to confirm it's correct:

<img src="/screenshots/tabbing_entry_audit.png" title="tabbing_entry_audit.png"
width="500" />

To print an audit sheet or print a list of ballots still out, use the
"Info" tab:

<img src="/screenshots/tabbing_entry_index-info.png"
title="tabbing_entry_index-info.png" width="300" />

### Changing A Single Round

If you need to make changes to a single round, even after the ballot has
been entered, or you need to do something special like assign a double
win, you can access the round by clicking on the room number/judge from
the schematic and then clicking "View/Edit Results." This will show you
the ballot for that round:

<img src="/screenshots/tabbing_entry_panel.png" title="tabbing_entry_panel.png"
width="500" />

If you are viewing an elim round, you will see tabs for each judge on
the panel - make sure you're editing the right judge's ballot:

<img src="/screenshots/tabbing_entry_panel-tabs.png"
title="tabbing_entry_panel-tabs.png" width="400" />

This will let you change the result, assign byes or forfeit/no shows,
and set ranks and speaker points. Note that this screen lets you
forcibly save any result you want - there are no constraint checks, so
by very careful that you are entering the results/points correctly.

You should also check the "Done" box next to each entry to indicate that
the ballot entry is complete.

**Important Note** - If you are having persistent issues with making
changes to a single round after results have already been entered, you
can try to dump all judges from the panel (by clicking on the judge from
the schematic and then choosing "Remove"), and then adding the same
judge(s) back into the panel and re-entering the results. This will
clear out any results you initially entered and let you start over from
scratch.

### Byes, Double Wins, Forfeits, etc.

From the "View/Edit Results" screen, you can assign byes, double wins,
forfeits, and any other combination of wins and losses you need.

For debate events, if you assign a bye, you should NOT assign a winner
in the "W" column.

When assigning a bye, you have the option of how to deal with speaker
points. If you leave the speaker points blank, the entry will receive
the average of their other speaker points for that round. If you enter
any points, even a 0, the entry will receive the points you entered.

For scheduled byes, you also have the option to assign a "debate-wide
bye" so that all competitors receive a "win" and average points.

<img src="/screenshots/tabbing_entry_panel-bye.png"
title="tabbing_entry_panel-bye.png" width="300" />

If instead of giving an entry a bye on the ballot you want to remove
them from the round and give them a scheduled bye, you can click on
their entry code from the schematic. Then, use the box on the sidebar to
either give that entry a bye, or to place an entry that has already been
given a bye into a round:

<img src="/screenshots/panel_manipulate_debate-round-edit-byes.png"
title="panel_manipulate_debate-round-edit-byes.png" width="300" />

### Coachovers / Walkovers

If an elim pairing results in entries from the same school debating each
other, and you don't manually "break brackets" to allow both entries to
advance, then the ballot entry screen for that round will show up as a
"Coachover," which will let you select which team advances. By default,
it will choose the higher seed:

<img src="/screenshots/tabbing_entry_index-coachover.png"
title="tabbing_entry_index-coachover.png" width="300" />

## Codebreakers

<img src="/screenshots/tabs_tabbing_codebreaker.png"
title="tabs_tabbing_codebreaker.png" />

To view the codebreaker for a round, use the "Codebreaker" menu option,
then select a timeslot from the sidebar:

<img src="/screenshots/tabbing_report_codebreaker.png"
title="tabbing_report_codebreaker.png" width="300" />

This will show you a list of entries in that timeslot, along with their
school codes.

## Event Status

<img src="/screenshots/tabs_tabbing_status.png" title="tabs_tabbing_status.png" />

The "Status" menu option gives you a convenient central place to view
the status of each event, such as how many ballots are still out,
whether a round is ready to pair, etc. Each tab gives you a different
overview of the events:

<img src="/screenshots/tabbing_status_dashboard-tabs.png"
title="tabbing_status_dashboard-tabs.png" width="400" />

The main "Dashboard" tab will show you a box for each event, with how
many rounds haven't started, how many ballots are still outstanding, and
the status of ballot entry:

<img src="/screenshots/tabbing_status_dashboard.png"
title="tabbing_status_dashboard.png" width="300" />

The "Started" tab lets you mark whether each round has started, so you
know if you need to track down a judge or competitor. First, select a
judge group and a timeslot - timeslots where all rounds have started
will turn green:

<img src="/screenshots/tabbing_status_starts-timeslots.png"
title="tabbing_status_starts-timeslots.png" width="300" />

Rounds which have not started will appear yellow in the left column. If
you click on a round, it will turn green and move to the right column.
If you are using online ballots, a judge can mark their round as started
themselves - once they do so, the round will be moved to the right.

<img src="/screenshots/tabbing_status_starts.png" title="tabbing_status_starts.png"
width="500" />

This screen can be used by people you have given "Data Entry Only"
access to for the tournament, such as ballot table staff or ballot
runners. So, for example, you can have a one person load up this screen
on their phone and walk through the hallway, quickly marking whether
each debate has started.

The "Confirmed" tab is identical to the "Started" tab - but rounds can
only be marked as confirmed by the tabroom, not judges. This is useful
if you want to manually confirm that each round marked as "started" was
actually started.

The "Collected" tab works the same way as the "Started" and "Confirmed"
tabs, but is designed for use at a ballot table, where they can mark
each round as collected as soon as the ballot comes in.

The "Entered" tab lets you quickly see which ballots are still left to
enter - clicking on a ballot will take you to the ballot entry screen
for that round.

## Breaks

<img src="/screenshots/tabs_tabbing_breaks.png" title="tabs_tabbing_breaks.png" />

The "Breaks" menu option just shows you which events have ballots
pending, or which are ready to move to the next round. Clicking an event
on the sidebar will take you to the schematic for that event.

## Entry Cards

<img src="/screenshots/tabs_tabbing_entrycards.png"
title="tabs_tabbing_entrycards.png" />

The "Entry Cards" menu option lets you search for an entry by last name
or entry code, and will then show you their results and any sweepstakes
points they earned:

<img src="/screenshots/tabbing_entry_card-search.png"
title="tabbing_entry_card-search.png" width="300" />

## Entering Sweepstakes

<img src="/screenshots/tabs_tabbing_entersweeps.png"
title="tabs_tabbing_entersweeps.png" />

The "Enter Sweeps" menu option is only used when entering in sweepstakes
points that you calculated externally, i.e. outside of Tabroom -
otherwise, you can use the built-in reports in the Results menu.

If you are manually keeping tracking of sweepstakes points, then you can
upload them as a CSV, or choose an event on the sidebar to enter them:

<img src="/screenshots/tabbing_entry_sweeps-event.png"
title="tabbing_entry_sweeps-event.png" width="400" />

<img src="/screenshots/tabbing_entry_sweeps.png" title="tabbing_entry_sweeps.png"
width="400" />
