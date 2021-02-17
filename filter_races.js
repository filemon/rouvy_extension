const nextButtonSelector = 'div.moreButton[id="snippet-moreButtonPlanned-component"] > a';

function getChallenges() {
    console.log('Getting challenges');
    return new Promise(function(resolve) {
        chrome.storage.local.get(['rouvy_challenges'], function(result) {
            resolve(JSON.parse(result.rouvy_challenges));
        })
    });
}

function createButton() {
    let button = document.createElement('button');
    button.type = "button";
    button.className = 'btn btn-info';
    button.onclick = async function () {
        await filterRaces();
    };
    button.style.marginTop = '10px';
    button.innerHTML = 'show official only';
    return button;
}

function getRaceDetails() {
    console.log('Getting race details');
    return new Promise(function(resolve) {
        chrome.storage.local.get(['rouvy_races'], function(result) {
            resolve(JSON.parse(result.rouvy_races));
        })
    });
}

function getCareerDetails() {
    console.log('Getting career details');
    return new Promise(function(resolve) {
        chrome.storage.local.get(['rouvy_career'], function(result) {
            resolve(JSON.parse(result.rouvy_career));
        })
    });
}

async function filterRaces() {
    for(let i=0;i<5;i++){
        try {
            await $(nextButtonSelector)[0].click();
            // Default timeout first time.
            await new Promise(function(resolve) {setTimeout(resolve, 2000)});
            // 2 sec timeout after the first.
        } catch (err) {
            // Ignore the timeout error.
            console.log(`Error: ${err}`);
        }
    }
    $('div.planned div.avatar22 a').not('a[href="/ROUVY"]').closest('tr').remove();
};

function filterRegistrations(race_details) {
    $('div.tableVT.invitations a').each(function() {
            let race_link =$(this).attr('href');
            let race = race_details['races'][race_link];
            if(!race) { //remove old invitations
                $(this).closest('tr').remove();
            }
    });
}

function appendField(header, sibling, tag, text) {
    const field = document.createElement(tag);
    field.innerHTML = text;
    header.insertBefore(field, sibling);
}

function updateTableHeader() {
    if($('div.tabcont.oncont.box.planned thead th:contains("Ascended")').length == 0) {
        const header_row = $('div.tabcont.oncont.box.planned thead tr')[0];
        appendField(header_row, header_row.children[4], 'th', "Estimated time (~2 W/kg)");
        appendField(header_row, header_row.children[4], 'th', "Challenge");
        appendField(header_row, header_row.children[4], 'th', "Carreer");
        appendField(header_row, header_row.children[4], 'th', "MAX %");
        appendField(header_row, header_row.children[4], 'th', "AVG %");
        appendField(header_row, header_row.children[4], 'th', "Ascended");
        appendField(header_row, header_row.children[4], 'th', "Route");
    } else {
        console.log("Header already updated before");
    }
}

function updateRaceDetail(row,details,carreer, challenges) {
    if($(row).children('td:contains("%")').length == 0) {
        appendField(row, row.children[4], 'td', details.estimated_time);
        appendField(row, row.children[4], 'td', challenges);
        appendField(row, row.children[4], 'td', carreer);
        appendField(row, row.children[4], 'td', details.max_grade);
        appendField(row, row.children[4], 'td', details.avg_grade);
        appendField(row, row.children[4], 'td', details.ascended);
        appendField(row, row.children[4], 'td', `<a href="${details.link}">${details.route}</a>`);
    } else {
        console.log("Row already updated before");
    }
}

async function enrichDetails() {
    updateTableHeader();
    let race_details = await getRaceDetails();
    let career = await getCareerDetails();
    let challenges = await getChallenges();

    filterRegistrations(race_details);

    $('div.planned div.avatar22 a').closest('tr').each(function() {
       let race_link = $($(this).find('a.btn')).attr('href');
       race_link = translateString(race_link);
       let race = race_details['races'][race_link];
       if(!race) { //some races might be missing in the source
           race = {
                   "details": {
                       "ascended": "",
                       "max_grade": "%",
                       "avg_grade": "",
                       "capacity": "",
                       "route": "",
                       "link": "",
                       "estimated_time":""
                   }
           }
       }
        updateRaceDetail(this, race.details, careerSteps(career,race.details.link),challengeRaces(challenges, race.details.link));
    });
}


function careerSteps(career,race_link) {
    let result = career.steps.map((step,index) => {
        let step_name = Object.keys(step)[0];
        if(career.steps[index][step_name].includes(race_link)) {
            return step_name;
        } else {
            return "";
        }
    });

    result = result.filter((item) => {
        return item != '';
    });
    return result.join();
}

function challengeRaces(challenges,race_link) {
    let ret = [];
    Object.keys(challenges.challenges).forEach(link =>  {
        if(challenges.challenges[link].routes.includes(race_link)) {
            ret.push(challenges.challenges[link].name);
        }
    });
    return ret.join();
}

function adjustNextButton() {
    let button = $(nextButtonSelector)[0];
    button.onclick = async function () {
        await new Promise(function(resolve) {setTimeout(resolve, 2000)});
        adjustNextButton(); //register event handler on fresh button;
        await enrichDetails();
    };
}

function translateString(input) {
    return input.replace('online-zavody','onlinerace').replace('virtuelle-strecken','onlinerace');
}


//$('div.moreButton[id="snippet-moreButtonPlanned-component"]').parent('div')[0].appendChild(createButton());
(async () => {
    await enrichDetails(); //enrich details on already loaded page
    adjustNextButton(); //enrich them after each next button click
})();