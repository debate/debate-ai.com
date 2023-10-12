/* ********************************
Cite Creator by Aaron Hardy
v. 1.1.1 3-25-2016

ashtarcommunications@gmail.com
http://paperlessdebate.com
Creates debate cites from meta tags or page info and copies to clipboard

Cite Creator is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License 3.0 as published by
the Free Software Foundation.

Cite Creator is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License 3 for more details.

For a copy of the GNU General Public License 3 see:
http://www.gnu.org/licenses/gpl-3.0.txt

Ideas for future improvements:
* Better handling for middle initials/3 word names
* Split name into first/last
* Make cite box minimize-able
* PDF handling
* Lexis-specific handling
* Immediately update/close box on settings change or disabling, without page reload
* Allow slashes in date instead of dashes
* Modularize code
******************************** */

//Save settings for later use
var objSettings = new Object();
setSettings(runComputeCite);

function setSettings(callback) {
	chrome.storage.sync.get(null, function (settings) {
		objSettings.enabled = settings.enabled;	
		objSettings.copyselected = settings.copyselected;
		objSettings.citeboxleft = settings.citeboxleft;
		objSettings.suppressrating = settings.suppressrating;
		objSettings.largefont = settings.largefont;
		objSettings.citeformat = settings.citeformat;
		objSettings.customciteformat = settings.customciteformat;
		
		callback();
	}); 
}

function runComputeCite() {
	//If enabled, run automatically the first time
	if(objSettings.enabled != 0) {computeCite();}
}	

function computeCite(strNewName, strNewQuals, strNewDate, strNewTitle, strNewPublication){

	//Variable declarations
	var arrDivs;
	var arrSpans;
	var arrMeta;
	var arrAuthors;
	var arrTitles;
	var arrPublications;

	var strRating;
	var strRatingClass;

	var strName;
	var strBodyText;
	var strByLine;
	var n;

	var strQuals;
	
	var arrDates;
	var strDate;
	var d;
	var Year;
	var ShortYear;
	var Month;
	var Day;

	var strTitle;
	var i;

	var strPublication;

	var strCite;

	var div;
	var sel;

	//Remove cite_container if it already exists
	div = document.getElementById('cite_container');
	if (div) {

		//Retrieve stored variables for persistence when only changing one item
		strName = div.getAttribute("data-name");
		strQuals = div.getAttribute("data-quals");
		Month = div.getAttribute("data-month");
		Day = div.getAttribute("data-day");
		Year = div.getAttribute("data-year");
		ShortYear = Year.toString().substr(2,2);
		if (ShortYear.indexOf("0")==0 && ShortYear != "00"){ShortYear = ShortYear.slice(1);}
		strTitle = div.getAttribute("data-title");
		strPublication = div.getAttribute("data-publication");
		strRating = div.getAttribute("data-rating");
		
		document.body.removeChild(document.getElementById('cite_container'));
	}

	//Load all Meta tags for use later
	arrMeta = document.getElementsByTagName("meta");

	//Start with an A rating if first time through
	if (typeof strRating=='undefined'){strRating = "A";}

	//If Name is empty, it's the first time through, so attempt to compute it - start with most likely tags
	if (typeof strName=='undefined'){
		arrAuthors = document.getElementsByName("author"); //Try author
		if (arrAuthors.length <= 0){arrAuthors = document.getElementsByName("Author");} //Try Author
		if (arrAuthors.length <= 0){arrAuthors = document.getElementsByName("sailthru.author");} //Try sailtru.author
		if (arrAuthors.length <= 0){arrAuthors = document.getElementsByName("byl");} //Try byl
		if (arrAuthors.length <= 0){arrAuthors = document.getElementsByName("byline");} //Try byline
		if (arrAuthors.length <= 0){arrAuthors = document.getElementsByName("DC.creator");} //Try DC.creator
		if (arrAuthors.length <= 0){
			for (i = 0; i < arrMeta.length; i++) {
					if (arrMeta[i].getAttribute("name")=="ces:authors"){strName = arrMeta[i].content;} //Try ces:authors meta tag
			}
		}
			
		//If anything found, assign the first hit to Name
		if (arrAuthors.length > 0){strName = arrAuthors[0].content;}
	}

	//Try to find a div of byline or author class - done separately from regex below for speed, to avoid looping all elements if unnecessary
	if (typeof strName=='undefined'){
		strRating = "A-";
		arrAuthors = document.getElementsByClassName("author");
		if (arrAuthors.length <= 0){arrAuthors = document.getElementsByClassName("byline");}
		if (arrAuthors.length > 0){
			strName = arrAuthors[0].innerText.trim(); //If anything found, assign Name the innerText
			if (strName.indexOf("\n") != -1){strName=strName.slice(0, strName.indexOf("\n")+1);} //Slice end if there's a newline
			if (strName.substring(0, 3) == "By " || strName.substring(0, 3) == "by " || strName.substring(0, 3) == "BY "){strName=strName.slice(3);} //Strip "By" from beginning
		}
	}

	//Try to find any div with "author" or "byline" in part of the id or classname
	if (typeof strName=='undefined'){
		strRating = "A-";
		//Loop all divs and look for a match
		arrDivs = document.getElementsByTagName("div");
		for (i=0; i<arrDivs.length; i++) {
			if ( arrDivs[i].id.search(/author/i) > -1 || arrDivs[i].className.search(/author/i) > -1 || arrDivs[i].id.search(/byline/i) > -1 || arrDivs[i].className.search(/byline/i) > -1 ) {
				strName = arrDivs[i].innerText.trim();
				if (strName.indexOf("\n") > 0){strName=strName.slice(0, strName.indexOf("\n")+1);} //Slice end if there's a newline
				if (strName.substring(0, 3) == "By " || strName.substring(0, 3) == "by " || strName.substring(0, 3) == "BY "){strName=strName.slice(3);} //Strip "By" from beginning
				n=nth_occurrence(strName, ' ', 2); //find 2nd space
				if (n>0){strName=strName.slice(0, n).trim();} //slice off everything after 2nd space
				break; //exit after first match
			}
		}
	}

	//Try the same thing with spans instead
	if (typeof strName=='undefined'){
		strRating = "B";
		//Loop all spans and look for a match
		arrSpans = document.getElementsByTagName("span");
		for (i=0; i<arrSpans.length; i++) {
			if ( arrSpans[i].id.search(/author/i) > -1 || arrSpans[i].className.search(/author/i) > -1 || arrSpans[i].id.search(/byline/i) > -1 || arrSpans[i].className.search(/byline/i) > -1 ) {
				strName = arrSpans[i].innerText.trim();
				if (strName.indexOf("\n") > 0){strName=strName.slice(0, strName.indexOf("\n")+1);} //Slice end if there's a newline
				if (strName.substring(0, 3) == "By " || strName.substring(0, 3) == "by " || strName.substring(0, 3) == "BY "){strName=strName.slice(3);} //Strip "By" from beginning
				n=nth_occurrence(strName, ' ', 2); //Find 2nd space
				if (n>0){strName=strName.slice(0, n).trim();} //Slice off everything after 2nd space
				break; //Exit after first match
			}
		}
	}

	//Attempt to manually find byline
	if (typeof strName=='undefined'){ 
		strRating = "B-";
		strBodyText=document.body.innerText; //Get all text on page
		if(strBodyText.length > 1000){strBodyText=strBodyText.slice(0,1000);} //Slice off after 1000 words to avoid false matches
		n=strBodyText.search(/\bby \b/i);	//Find first occurence of "by "
		if (n>-1){ //If match found
			strByLine=strBodyText.slice(n); //Slice off everything before "by"
			if (strByLine.indexOf("\n") != -1){strByLine=strByLine.slice(0, strByLine.indexOf("\n")+1);} //Slice end if there's a newline
			n=nth_occurrence(strByLine, ' ', 3); //Find 3rd space, 1 more than usual to account for By
			strByLine=strByLine.slice(0, n); //slice off everything after 3rd space
			//if (strByLine.indexOf(".") > -1){ //if Byline contains "." for middle initial
			//	n=nth_occurrence(strByLine, ' ', 3); //find 3rd space
			//	strByLine=strByLine.slice(0, n); //slice off end again
			//}
			strName=strByLine.slice(3); //slice off "By "
		}
	}

	//Clean up Name if found
	if (typeof strName!='undefined'){
		//Strip "By" from beginning if it made it through
		if (strName.substring(0, 3) == "By " || strName.substring(0, 3) == "by " || strName.substring(0, 3) == "BY "){strName=strName.slice(3);}
		//Strip "The" and "www." from beginning
		if (strName.substring(0, 4) == "The " || strName.substring(0, 4) == "the " || strName.substring(0, 4) == "THE "){strName=strName.slice(4);}
		if (strName.substring(0, 4) == "www." || strName.substring(0, 4) == "Www." || strName.substring(0, 4) == "WWW."){strName=strName.slice(4);}
		//Strip .Com from end
		if (strName.lastIndexOf(".com") != -1){strName=strName.slice(0, strName.lastIndexOf(".com"));}
		if (strName.lastIndexOf(".Com") != -1){strName=strName.slice(0, strName.lastIndexOf(".Com"));}
		if (strName.lastIndexOf(".COM") != -1){strName=strName.slice(0, strName.lastIndexOf(".COM"));}
		
		//Clean up extra byline info
		if (strName.indexOf("|") != -1){strName=strName.slice(0, strName.indexOf("|")-1);} //Slice off trailing |
		if (strName.indexOf("--") != -1){strName=strName.slice(0, strName.indexOf("--")-1);} //Slice off trailing --
		if (strName.indexOf(" - ") != -1){strName=strName.slice(0, strName.indexOf(" - "));} //Slice off trailing -
		if (strName.indexOf("/") != -1){strName=strName.slice(0, strName.indexOf("/"));} //Slice off trailing /
		if (strName.indexOf(":") != -1){strName=strName.slice(0, strName.indexOf(":"));} //Slice off trailing -
		
		//Make Name title case
		strName = toTitleCase(strName).trim();
		strName = strName.replace(' And ', ' and ');
	}

	//Find Date
	if (typeof Month=='undefined'){
		arrDates = document.getElementsByName("date"); //Try date
		if (arrDates.length <= 0){arrDates = document.getElementsByName("Date");} //Try Date
		if (arrDates.length <= 0){arrDates = document.getElementsByName("created");} //Try created
		if (arrDates.length <= 0){arrDates = document.getElementsByName("dat");} //Try dat
		if (arrDates.length <= 0){arrDates = document.getElementsByName("DC.date");} //Try DC.date
		if (arrDates.length <= 0){arrDates = document.getElementsByName("dc.date");} //Try dc.date
		if (arrDates.length <= 0){arrDates = document.getElementsByName("DC.date.issued");} //Try DC.date.issued
		if (arrDates.length <= 0){arrDates = document.getElementsByName("dc.date.issued");} //Try dc.date.issued
		if (arrDates.length <= 0){arrDates = document.getElementsByName("dcterms.created");} //Try dcterms.created
		if (arrDates.length <= 0){arrDates = document.getElementsByName("DCterms.created");} //Try DCterms.created
		if (arrDates.length <= 0){arrDates = document.getElementsByName("dcterms.modified");} //Try dcterms.modified
		if (arrDates.length <= 0){arrDates = document.getElementsByName("DCterms.modified");} //Try DCterms.modified
		if (arrDates.length <= 0){arrDates = document.getElementsByName("sailthru.date");} //Try sailthru.date

		//If anything found, assign it to Date
		if (arrDates.length > 0){strDate = arrDates[0].content;}		
		else{ //Try Regex
			if (strRating == "A"){strRating="A-";}
			else if (strRating == "A-"){strRating="B";}
			else if (strRating == "B"){strRating="B-";}
			else if (strRating == "B-"){strRating="C";}
			else if (strRating == "C"){strRating="C-";}

			strBodyText=document.body.innerText; //get all text on page
			if (strBodyText.length > 1500){strBodyText=strBodyText.slice(0,1500);} //slice off after 1500 words to avoid false matches and make search faster
			
			strDate = strBodyText.match(/\b\d{1,2}\/\d{1,2}\/(\d{2}|\d{4})\b/); //Match m/d/yy to mm/dd/yyyy
			if (strDate==null){strDate = strBodyText.match(/\b(1[0-2]|0?[1-9])-(3[01]|[12][0-9]|0?[1-9])-(?:[0-9]{2})?[0-9]{2}\b/);} //same with -
			if (strDate==null){strDate = strBodyText.match(/\b(1[0-2]|0?[1-9])\.(3[01]|[12][0-9]|0?[1-9])\.(?:[0-9]{2})?[0-9]{2}\b/);} //same with .
			if (strDate==null){strDate = strBodyText.match(/\b(?:(((Jan(uary)?|Ma(r(ch)?|y)|Jul(y)?|Aug(ust)?|Oct(ober)?|Dec(ember)?)\ 31)|((Jan(uary)?|Ma(r(ch)?|y)|Apr(il)?|Ju((ly?)|(ne?))|Aug(ust)?|Oct(ober)?|(Sept|Nov|Dec)(ember)?)\ (0?[1-9]|([12]\d)|30))|(Feb(ruary)?\ (0?[1-9]|1\d|2[0-8]|(29(?=,\ ((1[6-9]|[2-9]\d)(0[48]|[2468][048]|[13579][26])|((16|[2468][048]|[3579][26])00)))))))\,\ ((1[6-9]|[2-9]\d)\d{2}))\b/);} //match full month name
			if (strDate==null){strDate = strBodyText.match(/\b(?:(((Jan(uary)?|Ma(r(ch)?|y)|Jul(y)?|Aug(ust)?|Oct(ober)?|Dec(ember)?)\ 31)|((Jan(uary)?|Ma(r(ch)?|y)|Apr(il)?|Ju((ly?)|(ne?))|Aug(ust)?|Oct(ober)?|(Sept|Nov|Dec)(ember)?)\ (0?[1-9]|([12]\d)|30)(st|nd|rd|th))|(Feb(ruary)?\ (0?[1-9]|1\d|2[0-8]|(29(?=,\ ((1[6-9]|[2-9]\d)(0[48]|[2468][048]|[13579][26])|((16|[2468][048]|[3579][26])00)))))(st|nd|rd|th)))\,\ ((1[6-9]|[2-9]\d)\d{2}))\b/);} //match day with st/th/etc
			if (strDate==null){strDate = strBodyText.match(/\b(?:(((Jan(uary)?|Ma(r(ch)?|y)|Jul(y)?|Aug(ust)?|Oct(ober)?|Dec(ember)?)(.)?\ 31)|((Jan(uary)?|Ma(r(ch)?|y)|Apr(il)?|Ju((ly?)|(ne?))|Aug(ust)?|Oct(ober)?|(Sept|Nov|Dec)(ember)?)(.)?\ (0?[1-9]|([12]\d)|30))|(Feb(ruary)?(.)?\ (0?[1-9]|1\d|2[0-8]|(29(?=,\ ((1[6-9]|[2-9]\d)(0[48]|[2468][048]|[13579][26])|((16|[2468][048]|[3579][26])00)))))))\,\ ((1[6-9]|[2-9]\d)\d{2}))\b/);} //match month with period
			if (strDate==null){strDate = strBodyText.match(/\b((31(?!\ (Feb(ruary)?|Apr(il)?|June?|(Sep(?=\b|t)t?|Nov)(ember)?)))|((30|29)(?!\ Feb(ruary)?))|(29(?=\ Feb(ruary)?\ (((1[6-9]|[2-9]\d)(0[48]|[2468][048]|[13579][26])|((16|[2468][048]|[3579][26])00)))))|(0?[1-9])|1\d|2[0-8])\ (Jan(uary)?|Feb(ruary)?|Ma(r(ch)?|y)|Apr(il)?|Ju((ly?)|(ne?))|Aug(ust)?|Oct(ober)?|(Sep(?=\b|t)t?|Nov|Dec)(ember)?)\ ((1[6-9]|[2-9]\d)\d{2})\b/);} //match dd MMMM yyyy - works to find date but parser sometimes mixes up date/month
			if (strDate==null){strDate = strBodyText.match(/\b(?:(((Jan(uary)?|Ma(r(ch)?|y)|Jul(y)?|Aug(ust)?|Oct(ober)?|Dec(ember)?)\ 31)|((Jan(uary)?|Ma(r(ch)?|y)|Apr(il)?|Ju((ly?)|(ne?))|Aug(ust)?|Oct(ober)?|(Sept|Nov|Dec)(ember)?)\ (0?[1-9]|([12]\d)|30))|(Feb(ruary)?\ (0?[1-9]|1\d|2[0-8]|(29(?=,\ ((1[6-9]|[2-9]\d)(0[48]|[2468][048]|[13579][26])|((16|[2468][048]|[3579][26])00)))))))\,\ ((1[6-9]|[2-9]\d)\d{2}))\b/);} //match MMMM dd, yyyy
			if (strDate==null){strDate = strBodyText.match(/\b(?:(((JAN(UARY)?|MA(R(CH)?|Y)|JUL(Y)?|AUG(UST)?|OCT(OBER)?|DEC(EMBER)?)\ 31)|((JAN(UARY)?|MA(R(CH)?|Y)|APR(IL)?|JU((LY?)|(NE?))|AUG(UST)?|OCT(OBER)?|(SEPT|NOV|DEC)(EMBER)?)\ (0?[1-9]|([12]\d)|30))|(Feb(ruary)?\ (0?[1-9]|1\d|2[0-8]|(29(?=,\ ((1[6-9]|[2-9]\d)(0[48]|[2468][048]|[13579][26])|((16|[2468][048]|[3579][26])00)))))))\,\ ((1[6-9]|[2-9]\d)\d{2}))\b/);} //same with caps
			if (strDate==null){strDate = strBodyText.match(/\b(?:(((Jan(uary)?|Ma(r(ch)?|y)|Jul(y)?|Aug(ust)?|Oct(ober)?|Dec(ember)?)\ 31)|((Jan(uary)?|Ma(r(ch)?|y)|Apr(il)?|Ju((ly?)|(ne?))|Aug(ust)?|Oct(ober)?|(Sept|Nov|Dec)(ember)?)\ (0?[1-9]|([12]\d)|30))|(Feb(ruary)?\ (0?[1-9]|1\d|2[0-8]|(29(?=,\ ((1[6-9]|[2-9]\d)(0[48]|[2468][048]|[13579][26])|((16|[2468][048]|[3579][26])00)))))))\ ((1[6-9]|[2-9]\d)\d{2}))\b/);} //match MMMM dd yyyy
			if (strDate==null){strDate = strBodyText.match(/\b(?:(((JAN(UARY)?|MA(R(CH)?|Y)|JUL(Y)?|AUG(UST)?|OCT(OBER)?|DEC(EMBER)?)\ 31)|((JAN(UARY)?|MA(R(CH)?|Y)|APR(IL)?|JU((LY?)|(NE?))|AUG(UST)?|OCT(OBER)?|(SEPT|NOV|DEC)(EMBER)?)\ (0?[1-9]|([12]\d)|30))|(Feb(ruary)?\ (0?[1-9]|1\d|2[0-8]|(29(?=,\ ((1[6-9]|[2-9]\d)(0[48]|[2468][048]|[13579][26])|((16|[2468][048]|[3579][26])00)))))))\ ((1[6-9]|[2-9]\d)\d{2}))\b/);} //same with caps
			if (strDate==null){strDate = strBodyText.match(/\b(?:(((Jan(uary)?|Ma(r(ch)?|y)|Jul(y)?|Aug(ust)?|Oct(ober)?|Dec(ember)?)\.\ 31)|((Jan(uary)?|Ma(r(ch)?|y)|Apr(il)?|Ju((ly?)|(ne?))|Aug(ust)?|Oct(ober)?|(Sept|Nov|Dec)(ember)?)\.\ (0?[1-9]|([12]\d)|30))|(Feb(ruary)?\.\ (0?[1-9]|1\d|2[0-8]|(29(?=,\ ((1[6-9]|[2-9]\d)(0[48]|[2468][048]|[13579][26])|((16|[2468][048]|[3579][26])00)))))))\ ((1[6-9]|[2-9]\d)\d{2}))\b/);} //match MMMM. dd yyyy	
			if (strDate==null){strDate = strBodyText.match(/\b(?:(((JAN(UARY)?|MA(R(CH)?|Y)|JUL(Y)?|AUG(UST)?|OCT(OBER)?|DEC(EMBER)?)\.\ 31)|((JAN(UARY)?|MA(R(CH)?|Y)|APR(IL)?|JU((LY?)|(NE?))|AUG(UST)?|OCT(OBER)?|(SEPT|NOV|DEC)(EMBER)?)\.\ (0?[1-9]|([12]\d)|30))|(Feb(ruary)?\.\ (0?[1-9]|1\d|2[0-8]|(29(?=,\ ((1[6-9]|[2-9]\d)(0[48]|[2468][048]|[13579][26])|((16|[2468][048]|[3579][26])00)))))))\ ((1[6-9]|[2-9]\d)\d{2}))\b/);} //same with caps
			if (strDate==null){strDate = strBodyText.match(/\b(?:(((Jan(uary)?|Ma(r(ch)?|y)|Jul(y)?|Aug(ust)?|Oct(ober)?|Dec(ember)?)\.\ 31)|((Jan(uary)?|Ma(r(ch)?|y)|Apr(il)?|Ju((ly?)|(ne?))|Aug(ust)?|Oct(ober)?|(Sept|Nov|Dec)(ember)?)\.\ (0?[1-9]|([12]\d)|30))|(Feb(ruary)?\.\ (0?[1-9]|1\d|2[0-8]|(29(?=,\ ((1[6-9]|[2-9]\d)(0[48]|[2468][048]|[13579][26])|((16|[2468][048]|[3579][26])00)))))))\,\ ((1[6-9]|[2-9]\d)\d{2}))\b/);} //match MMMM. dd, yyyy	
			if (strDate==null){strDate = strBodyText.match(/\b(?:(((JAN(UARY)?|MA(R(CH)?|Y)|JUL(Y)?|AUG(UST)?|OCT(OBER)?|DEC(EMBER)?)\.\ 31)|((JAN(UARY)?|MA(R(CH)?|Y)|APR(IL)?|JU((LY?)|(NE?))|AUG(UST)?|OCT(OBER)?|(SEPT|NOV|DEC)(EMBER)?)\.\ (0?[1-9]|([12]\d)|30))|(Feb(ruary)?\.\ (0?[1-9]|1\d|2[0-8]|(29(?=,\ ((1[6-9]|[2-9]\d)(0[48]|[2468][048]|[13579][26])|((16|[2468][048]|[3579][26])00)))))))\,\ ((1[6-9]|[2-9]\d)\d{2}))\b/);} //same with caps
			
			if (strDate!=null){strDate = strDate[0];} //Select only first match from regex result array
			
			//If still nothing found, reduce rating again
			if (strDate==null || typeof strDate=='undefined'){
				if (strRating == "A"){strRating="B";}
				else if (strRating == "A-"){strRating="B-";}
				else if (strRating == "B"){strRating="C";}
				else if (strRating == "B-"){strRating="C-";}
				else if (strRating == "C"){strRating="D";}
				else if (strRating == "C-"){strRating="D-";}
			}	
		}

		//Convert date with parser
		if (strDate !=null && typeof strDate!='undefined'){
			//Clean up date if it has a combined date/time code that breaks parser
			if (strDate.length > 10 && strDate.indexOf(" ") == -1 && strDate.indexOf("T") == 10){strDate = strDate.slice(0,10);}
			
			d = Date.parse(strDate);
			if (d != null){
				Year = d.getFullYear();
				ShortYear = Year.toString().substr(2,2);
				if (ShortYear.indexOf("0")==0 && ShortYear != "00"){ShortYear = ShortYear.slice(1);}
				Month = d.getMonth();
				Month = Month + 1; //Add 1 becasue getMonth returns 0-11
				Month = Month + ''; //Convert to string
				if (Month.indexOf("0")==0){Month = Month.slice(1);} //Slice leading 0
				Day = d.getDate();
				Day = Day + ''; //Convert to string
				if (Day.indexOf("0")==0){Day = Day.slice(1);} //Slice leading 0
			}
		}
	}

	//Find Title
	if (typeof strTitle=='undefined'){
		arrTitles = document.getElementsByName("og:title"); //Try og:title
		if (arrTitles.length <= 0){arrTitles = document.getElementsByName("DC.title");} //Try DC.title
		if (arrTitles.length <= 0){arrTitles = document.getElementsByName("headline");} //Try headline
		if (arrTitles.length <= 0){ //If no name tags, loop meta tags instead
			for (i = 0; i < arrMeta.length; i++) {
				if (arrMeta[i].getAttribute("property")=="og:title"){strTitle = arrMeta[i].content;} //Find og:title in property attributes
			}
		}

		//If anything found, assign it to Title
		if (typeof arrTitle!='undefined'){strTitle = arrTitles[0].content;}

		//Worst case, use html title
		if (typeof strTitle=='undefined'){
			strTitle = document.title;    
		}

		//Slice off | and -
		if (typeof strTitle!='undefined'){
			if (strTitle.indexOf("|") != -1){strTitle=strTitle.slice(0, strTitle.indexOf("|")-1);} //Slice off trailing |
			if (strTitle.indexOf("--") != -1){strTitle=strTitle.slice(0, strTitle.indexOf("--")-1);} //Slice off trailing --
			if (strTitle.indexOf(" - ") != -1){strTitle=strTitle.slice(0, strTitle.indexOf(" - "));} //Slice off trailing -
		}
	}

	//Find Publication
	if (typeof strPublication=='undefined'){
		arrPublications = document.getElementsByName("og:site_name"); //Try og:site_name
		if (arrPublications.length <= 0){arrPublications = document.getElementsByName("cre");} //Try cre
		if (arrPublications.length <= 0){ //If no name tags, loop meta tags instead
			for (i = 0; i < arrMeta.length; i++) {
				if (arrMeta[i].getAttribute("property")=="og:site_name"){strPublication = arrMeta[i].content;} //Find og:site_name in property attributes
			}
		}
		//If anything found, assign it to Publication
		if (arrPublications.length > 0){strPublication = arrPublications[0].content;}

		//Clean up publication name
		if (typeof strPublication!='undefined'){
			//Strip "The" and "www." from beginning
			if (strPublication.substring(0, 4) == "The " || strPublication.substring(0, 4) == "the " || strPublication.substring(0, 4) == "THE "){strPublication=strPublication.slice(4);}
			if (strPublication.substring(0, 4) == "www." || strPublication.substring(0, 4) == "Www." || strPublication.substring(0, 4) == "WWW."){strPublication=strPublication.slice(4);}
			
			//Strip .Com from end
			if (strPublication.lastIndexOf(".com") != -1){strPublication=strPublication.slice(0, strPublication.lastIndexOf(".com"));}
			if (strPublication.lastIndexOf(".Com") != -1){strPublication=strPublication.slice(0, strPublication.lastIndexOf(".Com"));}
			if (strPublication.lastIndexOf(".COM") != -1){strPublication=strPublication.slice(0, strPublication.lastIndexOf(".COM"));}
			//Trim string
			strPublication = strPublication.trim();
		}
		else {
			//No publication found, reduce rating
			if (strRating == "A"){strRating="A-";}
			else if (strRating == "A-"){strRating="B";}
			else if (strRating == "B"){strRating="B-";}
			else if (strRating == "B-"){strRating="C";}
			else if (strRating == "C"){strRating="C-";}
			else if (strRating == "C-"){strRating="D";}
			else if (strRating == "D"){strRating="D-";}
		}
		//If no Name was found, assign Publication to Name
		if (typeof strName==='undefined' || strName.length == 0){strName = strPublication;}
	}

	//Error trap for empty variables, just to be safe
	if (typeof strName==='undefined'){strName="No Author";}
	if (typeof strQuals==='undefined'){strQuals="";}
	if (typeof Month==='undefined'){Month="xx";}
	if (typeof Day==='undefined'){Day="xx";}
	if (typeof Year==='undefined'){Year="xxxx";}
	if (typeof ShortYear==='undefined'){ShortYear="xx";}
	if (typeof strTitle==='undefined'){strTitle=document.title;}
	if (typeof strPublication==='undefined'){strPublication="No Publication";}

	//If parameters were passed in, override the results. Inefficient to wait until the end, but makes recomputing parts individually easier
	if (typeof strNewName!='undefined') {
		strName = strNewName.trim();
		strName = toTitleCase(strName).trim();
		strName = strName.replace(' And ', ' and ');
	}
	if (typeof strNewQuals!='undefined') {strQuals = strNewQuals.trim()+', ';} //Manually add trailing ", "
	if (typeof strNewDate!='undefined') {
		
		//If only a year, manually assign Month/Day to stop parser thinking it's today
		if (strNewDate.length == 4 && (strNewDate.substr(0,2)=='19' || strNewDate.substr(0,2)=='20')){
			Year = strNewDate;
			ShortYear = Year.toString().substr(2,2);
			if (ShortYear.indexOf("0")==0 && ShortYear != "00"){ShortYear = ShortYear.slice(1);}
			Month = '';
			Day = '';
		}
		else {
			var d; //Redeclare variable to clear it
			d = Date.parse(strNewDate);
			if (d != null){
				Year = d.getFullYear();
				ShortYear = Year.toString().substr(2,2);
				if (ShortYear.indexOf("0")==0 && ShortYear != "00"){ShortYear = ShortYear.slice(1);}
				Month = d.getMonth();
				Month = Month + 1; //Add 1 because getMonth returns 0-11
				Month = Month + ''; //Convert to string
				if (Month.indexOf("0")==0){Month = Month.slice(1);} //Slice leading 0
				Day = d.getDate();
				Day = Day + ''; //Convert to string
				if (Day.indexOf("0")==0){Day = Day.slice(1);} //Slice leading 0
			}
		}
	}
	if (typeof strNewTitle!='undefined') {
		strTitle = strNewTitle.trim();
		strTitle = toTitleCase(strTitle).trim();
	}
	if (typeof strNewPublication!='undefined') {
		strPublication = strNewPublication.trim();
		strPublication = toTitleCase(strPublication).trim();
	}

	//Construct cite and print it to the console for debugging
	switch(objSettings.citeformat)
	{
	case 1: //Frontloaded	
		if (strName==strPublication){ //If name=publication, don't print twice
			strCite = strName+' '+ShortYear+', '+strQuals+Month+'-'+Day+'-'+Year+', '+'"'+strTitle+'," '+document.URL; 
			strCite = strCite.replace(', --', ', '); //Fix empty month/day
			console.log(strCite);
		}
		else{
			strCite = strName+' '+ShortYear+', '+strQuals+Month+'-'+Day+'-'+Year+', '+'"'+strTitle+'," '+strPublication+', '+document.URL;
			strCite = strCite.replace(', --', ', '); //Fix empty month/day		
			console.log(strCite);
		}
		break;
	case 2: //Custom
		strCite = objSettings.customciteformat;
		
		if (strName==strPublication){strCite = strCite.replace('%publication%', '');}
		
		strCite = strCite.replace(/%author%/g, strName);
		strCite = strCite.replace(/%y%/g, ShortYear);
		strCite = strCite.replace(/%quals%/g, strQuals);
		strCite = strCite.replace(/%date%/g, Month+'-'+Day+'-'+Year);
		strCite = strCite.replace(/%title%/g, strTitle);
		strCite = strCite.replace(/%publication%/g, strPublication);
		strCite = strCite.replace(/%url%/g, document.URL);
		strCite = strCite.replace(/%accessed%/g, Date.today().toString('M-d-yyyy'));
		
		strCite = strCite.replace(/,,/g,',');
		strCite = strCite.replace(/, ,/g,',');
		strCite = strCite.replace(/ , /g,' ');
		strCite = strCite.replace(', --', ', '); //Fix empty month/day
		console.log(strCite);
		
		break;
	default: //Standard		
		if (strName==strPublication){ //If name=publication, don't print twice
			strCite = strName+', '+strQuals+Month+'-'+Day+'-'+Year+', '+'"'+strTitle+'," '+document.URL; 
			strCite = strCite.replace(', --', ', '); //Fix empty month/day
			console.log(strCite);
		}
		else{
			strCite = strName+', '+strQuals+Month+'-'+Day+'-'+Year+', '+'"'+strTitle+'," '+strPublication+', '+document.URL;
			strCite = strCite.replace(', --', ', '); //Fix empty month/day
			console.log(strCite);
		}
		break;
	}
	
	//Add cite_container div to the bottom of the page - pick right or left based on settings
	div = document.createElement('div');
	div.id = 'cite_container';
	
	if (objSettings.citeboxleft == 1) {
		div.className += 'cite_container_left';
	}
	else {
		div.className += 'cite_container_right';
	}
	
	if (document.body.firstChild){
	  document.body.insertBefore(div, document.body.firstChild);
	}
	else{
	  document.body.appendChild(div);
	}

	//Save cite parts as div attributes
	div.setAttribute("data-name", strName);
	div.setAttribute("data-quals", strQuals);
	div.setAttribute("data-month", Month);
	div.setAttribute("data-day", Day);
	div.setAttribute("data-year", Year);
	div.setAttribute("data-title", strTitle);
	div.setAttribute("data-publication", strPublication);
	div.setAttribute("data-rating", strRating);

	//Parse Rating to assign classname so it's the right color
	switch(strRating)
	{
	case "A":
	case "A-":
	case "B":
	  strRatingClass="cite_green";
	  break;
	case "B-":
	case "C":
	  strRatingClass="cite_yellow";
	  break;
	case "C-":
	case "D":
	case "D-":
	  strRatingClass="cite_red";
	  break;
	default:
	  strRatingClass="cite_red";
	  break;
	}

	//Set div innerHTML
	div.innerHTML = "<div id=\"cite_close\">x</div>";
	//Include rating unless Suppress Rating is set
	if (objSettings.suppressrating != 1) {
		div.innerHTML += "<div id=\"cite_rating\" class=\"" + strRatingClass + "\"><span>" + strRating + "</span></div>";
	}
	div.innerHTML += "<br /><div id=\"cite_content\">" + strCite + "</div>";

	//If large font is set, override font size
	if (objSettings.largefont == 1) {
		document.getElementById ("cite_content").style.fontSize = "16px";
	}
	
	//Add a listener for clicking the "x" to close
	document.getElementById ("cite_close").addEventListener ("click", closeCite, false);
}

//Utility functions
function nth_occurrence (string, char, nth){
    var first_index = string.indexOf(char);
    var length_up_to_first_index = first_index + 1;

    if (nth == 1) {
        return first_index;
    } else {
        var string_after_first_occurrence = string.slice(length_up_to_first_index);
        var next_occurrence = nth_occurrence(string_after_first_occurrence, char, nth - 1);

        if (next_occurrence === -1) {
            return -1;
        } else {
            return length_up_to_first_index + next_occurrence;  
        }
    }
}

function toTitleCase(str){
    return str.replace(/\w*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

function closeCite(){
	//Add cite_closed class to the container div, which makes it invisible
	document.getElementById('cite_container').className += ' cite_closed';
}

//Keyboard shortcut functions
Mousetrap.bind('ctrl+alt+c', function(e) {
	
	var copyDiv = document.getElementById('cite_content');
	
	//Flash the cite text for 300ms to show it's being copied
	copyDiv.style.color = "blue";
	setTimeout(function(){copyDiv.style.color = "white";}, 300);

	//If option set, get selected text
	if(objSettings.copyselected == 1) {
		if (window.getSelection) {
			var sel = "\n" + window.getSelection().toString();
			//Send message to the background page with text to copy - tack selection onto cite
			chrome.extension.sendMessage({"text" : copyDiv.innerHTML + sel});
		}
		else {
			chrome.extension.sendMessage({"text" : copyDiv.innerHTML});
		}
	}
	else {
		chrome.extension.sendMessage({"text" : copyDiv.innerHTML});
	}		
	
    return false;
});

Mousetrap.bind('ctrl+alt+1', function(e) {
	
	//Get selection
	if (window.getSelection) {
		var strNewName = window.getSelection().toString();
	}
	
	computeCite(strNewName, undefined, undefined, undefined, undefined);
	
    return false;
});

Mousetrap.bind('ctrl+alt+2', function(e) {
	
	//Get selection
	if (window.getSelection) {
		var strNewQuals = window.getSelection().toString();
	}
	
	computeCite(undefined, strNewQuals, undefined, undefined, undefined);
	
    return false;
});

Mousetrap.bind('ctrl+alt+3', function(e) {
	
	//Get selection
	if (window.getSelection) {
		var strNewDate = window.getSelection().toString();
	}
	
	computeCite(undefined, undefined, strNewDate, undefined, undefined);
	
    return false;
});

Mousetrap.bind('ctrl+alt+4', function(e) {
	
	//Get selection
	if (window.getSelection) {
		var strNewTitle = window.getSelection().toString();
	}
	
	computeCite(undefined, undefined, undefined, strNewTitle, undefined);
	
    return false;
});

Mousetrap.bind('ctrl+alt+5', function(e) {
	
	//Get selection
	if (window.getSelection) {
		var strNewPublication = window.getSelection().toString();
	}
	
	computeCite(undefined, undefined, undefined, undefined, strNewPublication);
	
    return false;
});