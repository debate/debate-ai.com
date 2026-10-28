/**
 * Snapshot of the TOC bids sheet (`TOC_BIDS_SHEET_URL`) as of
 * 2026-10-22, tab-separated as copied out of the sheet.
 *
 * `/api/toc-bids` serves this when Google cannot be reached, so the policy
 * rankings keep their Bids column through an outage. It goes stale as bids are
 * awarded: refresh it by pasting the sheet over the text below. The Barack
 * Obama row is kept exactly as the sheet has it (Team and Debaters typed into
 * one quoted cell) because the parser has to cope with it live too.
 *
 * @module sync/toc-bids-snapshot
 */

import { parseTocBidsSheet, type TocBidTeam } from "./sync-toc-bids-sheet";

/** When {@link TOC_BIDS_SNAPSHOT_TSV} was copied from the sheet. */
export const TOC_BIDS_SNAPSHOT_DATE = "2026-10-22";

/** The sheet's text at {@link TOC_BIDS_SNAPSHOT_DATE}. */
export const TOC_BIDS_SNAPSHOT_TSV = `Bids	Team	Debaters	State	Bid 1	Bid 2	Bid 3
3	Baltimore City HW	Hoard & Walter	MD	NSDSO	Georgetown Day	NYCIDST
3	Blue Valley West BJ	Bapat & Jampana	KS	Washburn Rural	Mid America Cup	BVSW
3	Carrollton School of the Sacred Heart GM	Gomez-Peralta & Membiela	FL	NSDSO	Greenhill	New Trier
3	College Prep NT	Nahm & Tarnas	CA	Greenhill	Jack Howe	St Mark's
3	Newark Science OO	Odra & Olagadeyo	NJ	Greenhill	Georgetown Day	NYCIDST
2	Bellarmine CS	Chang & Sontakke	CA	Greenhill	Jack Howe
2	Carrollton School of the Sacred Heart GR	Giampetruzzi & Roos	FL	NSDSO	Greenhill
2	Cuttlefish Independent CO	Chen & Olteanu	WA	NSDSO	Jack Howe
2	Georgetown Day KN	Kim & Noland	DC	Georgetown Day	NYCIDST
2	Greenhill BS	Bose & Sunkara	TX	Grapevine	Greenhill
2	Liberal Arts and Science LR	Liu & Raghavan	TX	Grapevine	New Trier
2	New Trier MY	Ma & Yang	IL	Greenhill	New Trier
2	Quarry Lane KM	Khanna & Mehta	CA	Greenhill	St Mark's
2	Walter Payton BR	Bendre & Rout	IL	Greenhill	New Trier
2	Westwood GL	Gupta & Laxminarasimhan	TX	Greenhill	St Mark's
2	Woodward JS	Jain & Semaan	GA	Marist	St Mark's
1	Archbishop Mitty TW	Tian & Wang	CA	NSDSO
1	"
Barack Obama Male Leadership Academy JV
Jeffries & Valle"	TX	Greenhill
1	Bellarmine BH	Bauman & Huynh	CA	Jack Howe
1	Blue Valley North NP	Nandula & Parsons	KS	Washburn Rural
1	Blue Valley Southwest KL	Kommineni & Lin	KS	Washburn Rural
1	Brooklyn Technical GS	Grider & Sukhal	NY	NYCIDST
1	Brophy HS	Han & Sonawane	AZ	NYCIDST
1	Carrollton School of the Sacred Heart BG	Bracamontes & Gupta	FL	Grapevine
1	Collegiate FK	Ferreira & Kitkowski	NY	NYCIDST
1	Cuttlefish Independent CG	Chen & Goswami	WA	Jack Howe
1	Damien-St Lucy's KN	Kaissi & Nguyen	CA	Jack Howe
1	Georgetown Day GK	Gerety & Kimbrell	DC	NYCIDST
1	Glenbrook North KW	Kohler & Weisman	IL	New Trier
1	Glenbrook South MS	Martinez & Samet	IL	Niles
1	Greenhill GM	Ghelani & Makhani	TX	New Trier
1	Greenhill HK	Haq & Khan	TX	St Mark's
1	Greenhill HS	He & Sunkara	TX	St Mark's
1	Heritage Hall HH	Harris & Horvath	OK	Washburn Rural
1	Interlake CG	Chen & Goswami	WA	Mid America Cup
1	Isidore Newman AG	Agrawal & Wang	LA	NYCIDST
1	James Logan AK	Amiri & Kolluru	CA	NSDSO
1	Liberal Arts and Science CV	Conley & Vidal	TX	Greenhill
1	Liberal Arts and Science JL	Jallepalli & Lim	TX	Grapevine
1	Liberal Arts and Science KM	Kummaraguntla & Martis	TX	Greenhill
1	Little Rock Central BaWa	Batcheller & Ware	AR	Grapevine
1	Little Rock Central BuWi	Buckner & Wilkerson	AR	Grapevine
1	Little Rock Central LW	Liu & Wu	AR	Greenhill
1	Modern Brain JW	Jiang & Wu	CA	Jack Howe
1	Montgomery Bell BF	Brandes & Fulwider	TN	St Mark's
1	Montgomery Bell BV	Brandes & Vari	TN	Greenhill
1	Montgomery Bell MF	Majhail & Fulwider	TN	Westminster
1	New Trier AC	Angres & Chen	IL	Niles
1	New Trier HL	Heftman & Leaker	IL	Niles
1	North Broward AG	Atherton & Gujarathi	FL	New Trier
1	Northside College Prep GS	Garapaty & Sebastian	IL	Niles
1	Northview NT	Nadkar & Tapaswi	GA	Westminster
1	Pace RW	Royal & Washington	GA	Marist
1	Pembroke Hill MZ	Murphy & Zhao	MO	New Trier
1	Peninsula LP	Liu & Pan	CA	St Mark's
1	Richland AG	Agrawal & Ganta	TX	Grapevine
1	Rowland Hall LV	Lieberman & Venkatesan	UT	Jack Howe
1	Somerville CM	Castro & Marable	MA	Georgetown Day
1	St Paul Central BM	Berger & Mulrooney	MN	NSDSO
1	Taipei American CM	Chiong & Maeng	TW	TSDI
1	Taipei American WY	Wu & Yao	TW	TSDI
1	Washburn Rural CC	Chaudhry & Chidambaranthan	KS	BVSW
1	West HS SLC AK	Aoki & Krishna	UT	NSDSO
1	Westwood ND	Nandigam & Du	TX	Grapevine
1	Whitney Young BM	Boss & Mohan	IL	Greenhill
`;

/** {@link TOC_BIDS_SNAPSHOT_TSV}, parsed. */
export const tocBidsSnapshot = (): TocBidTeam[] => parseTocBidsSheet(TOC_BIDS_SNAPSHOT_TSV);
