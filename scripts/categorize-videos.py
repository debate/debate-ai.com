#!/usr/bin/env python3
"""
Categorizes debate videos by style/format and updates JSON files.

Categories:
  pf      - Public Forum
  ld      - Lincoln-Douglas
  policy  - High School Policy/CX
  college - College Policy (NDT/CEDA)
"""

import json
import re
import os

COLLEGE_CHANNELS = {
    'Lincoln Garrett', 'Joe Leeson-Schatz', 'CEDADebate', 'Exodus Files',
    'Aaron Trujillo', 'LASA Debate', 'Policy Debate Central', '2015 NDT',
    'NDT Streams', 'Debate Stream', 'DDI Debate', 'Texas Debate',
    'Wake Debate', 'Kentucky Debate', 'Spencer Anderson McElligott',
    'Arvind Shankar', 'North Broward MR', 'Debate Stream (Debate Stream)',
    'Vintage Debate Vids', 'Jacob Wilkus',
}

HS_POLICY_CHANNELS = {
    'Resolved Debate', 'SU Debate Rounds', 'Barkley Forum Videos',
}

# College team name fragments that appear in titles
COLLEGE_TEAMS = [
    'northwestern', 'emory', 'michigan', 'kansas', 'dartmouth', 'georgetown',
    'iowa', 'wake forest', 'georgia', 'indiana', 'msu', 'michigan state',
    'fort hays', 'kentucky', 'csu long beach', 'rutgers', 'binghamton',
    'wichita state', 'uco ', 'ucf ', 'jmu ', 'james madison', 'odu ',
    'old dominion', 'umkc', 'gonzaga', 'st mary', 'wyoming', 'new school ',
    'gmu ', 'george mason', 'towson', 'utd ', 'ut dallas', 'nyu ',
    'unc ', 'smu ', 'notre dame', 'miami', 'louisville', 'cal ', 'berkeley',
    'fullerton', 'vermont', 'oklahoma', ' ou ', 'asu ', 'arizona state',
    'ucb ', 'uf ', 'florida ', 'wvu ', 'west virginia',
]

# High school team/school name fragments
HS_SCHOOLS = [
    'harker', 'flintridge', 'isidore newman', 'greenhill', 'horace greeley',
    'lynbrook', 'harvard-westlake', 'wheatley', 'american heritage',
    'cary academy', 'northern valley', 'lawrenceville', 'lexington ',
    'bellarmine', 'new trier', 'little rock', 'altamont', 'mission san jose',
    'strake jesuit', 'lincoln sudbury', 'university mn', 'bethesda',
    'mba ', ' mba', 'westwood st', 'taipei american', 'lasa ', ' lasa',
    'peninsula ', 'cal ms', 'cal sw',
]

COLLEGE_TITLE_KEYWORDS = [
    ' ndt ', ' ndt$', '^ndt ', 'ndt 20', 'ndt-',
    'ceda ', ' ceda', 'ceda 20',
    'shirley', 'pflaum', 'irvinerr', 'dartmouthrr', 'acc debate',
    'texas open', 'fullerton 20', ' uf ', 'vanderbilt round', 'vanderbilt finals',
    'vanderbilt semi',
]


def classify_video(vid_id, title, date, channel, views, desc):
    ch = channel or ''
    title_l = title.lower()
    desc_l = (desc or '').lower()

    # --- PF (Public Forum) ---
    if ch == 'PF Videos':
        return 'pf'
    if '[pf rewind]' in title_l:
        return 'pf'
    # Match " PF " or at word boundary
    if re.search(r'\bpf\b', title_l) and 'pflaum' not in title_l:
        return 'pf'
    if 'public forum' in title_l:
        return 'pf'

    # --- LD (Lincoln-Douglas) ---
    if ch == 'National Symposium for Debate ':
        return 'ld'
    if re.search(r'\bld\b', title_l):
        return 'ld'
    if 'lincoln-douglas' in title_l or 'lincoln douglas' in title_l:
        return 'ld'

    # --- College Policy ---
    if ch in COLLEGE_CHANNELS:
        return 'college'

    # Title keywords strongly indicating college
    for kw in COLLEGE_TITLE_KEYWORDS:
        if re.search(kw, title_l):
            return 'college'

    # --- HS Policy ---
    if ch in HS_POLICY_CHANNELS:
        return 'policy'

    if '#policydebate' in desc_l:
        return 'policy'

    # Mixed channel: PolicyDebateCentral (no space)
    if ch == 'PolicyDebateCentral':
        for hs in HS_SCHOOLS:
            if hs in title_l:
                return 'policy'
        return 'college'

    # Infer from team names in title
    for hs in HS_SCHOOLS:
        if hs in title_l:
            return 'policy'

    for coll in COLLEGE_TEAMS:
        if re.search(r'\b' + re.escape(coll.strip()), title_l):
            return 'college'

    # Default for unrecognized: college (most remaining are college policy)
    return 'college'


def categorize_file(input_path):
    with open(input_path) as f:
        data = json.load(f)

    counts = {'pf': 0, 'ld': 0, 'policy': 0, 'college': 0}
    result = []
    for video in data:
        if len(video) >= 6:
            vid_id, title, date, channel, views, desc = video[0], video[1], video[2], video[3], video[4], video[5]
            # Preserve any existing elements beyond index 5 except the category slot
            extra = video[7:] if len(video) > 7 else []
            style = classify_video(vid_id, title, date, channel, views, desc)
            counts[style] += 1
            result.append([vid_id, title, date, channel, views, desc, style] + extra)
        else:
            result.append(video)

    print(f'{os.path.basename(input_path)}: {counts}  total={sum(counts.values())}')
    return result


def main():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base, 'lib', 'debate-data')

    files = ['debate-rounds-videos.json', 'debate-top-picks.json', 'debate-lectures.json']

    for fname in files:
        path = os.path.join(data_dir, fname)
        if not os.path.exists(path):
            print(f'Skipping {fname} (not found)')
            continue
        result = categorize_file(path)
        with open(path, 'w') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f'  -> wrote {path}')


if __name__ == '__main__':
    main()
