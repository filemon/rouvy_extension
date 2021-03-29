const nextButtonSelector = 'div.moreButton[id="snippet-moreButtonPlanned-component"] > a';
const filterButtonSelector = 'input.btn.btn-success';

function getChallenges() {
    console.log('Getting challenges');
    return new Promise(function(resolve) {
        chrome.storage.local.get(['rouvy_challenges'], function(result) {
            resolve(JSON.parse(result.rouvy_challenges));
        })
    });
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

async function filterRegistrations() {
    let race_details = await getRaceDetails();
    $('div.tableVT.invitations a').each(function() {
            let race_link =remove_special_parameters($(this).attr('href'));
            let race = race_details['races'][race_link];
            let invitation = $(this).closest('tr');
            if(!race) { //remove old invitations
                invitation.remove();
            } else {
                let date = new Date(race.date + 'Z'); //handle locale time
                appendField(invitation[0], invitation[0].children[1], 'td', `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`);
            }
    });
}

function appendField(header, sibling, tag, text) {
    const field = document.createElement(tag);
    field.innerHTML = text;
    header.insertBefore(field, sibling);
}
function removeField(element) {
    element.remove();
}

function updateTableHeader() {
    if($('div.tabcont.oncont.box.planned thead th:contains("Ascended")').length == 0) {
        const header_row = $('div.tabcont.oncont.box.planned thead tr')[0];
        if(header_row) { //we can be on the race detail
            removeField(header_row.children[0]);//remove status
            appendField(header_row, header_row.children[4], 'th', "Estimated time (~2 W/kg)");
            appendField(header_row, header_row.children[4], 'th', "Challenge");
            appendField(header_row, header_row.children[4], 'th', "Carreer");
            appendField(header_row, header_row.children[4], 'th', "MAX %");
            appendField(header_row, header_row.children[4], 'th', "AVG %");
            appendField(header_row, header_row.children[4], 'th', "Ascended");
            appendField(header_row, header_row.children[4], 'th', "Route");
        }
    } else {
        console.log("Header already updated before");
    }
}

function updateRaceDetail(row,details,carreer, challenges) {
    if($(row).children('td:contains("%")').length == 0) {
        removeField(row.children[0]);//remove status
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

function remove_special_parameters(link) {
    return link.split('?')[0];
}

function updateContentWidth() {
    $('div.events')[0].style.width="1400px";
}

async function enrichDetails() {
    updateContentWidth();
    updateTableHeader();
    let race_details = await getRaceDetails();
    let career = await getCareerDetails();
    let challenges = await getChallenges();

    $('div.planned div.avatar22 a').closest('tr').each(function() {
       let race_link = $($(this).find('a.btn')).attr('href');
       race_link = remove_special_parameters(translateString(race_link));
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

function adjustButtons() {
    let button = $(nextButtonSelector)[0];
    let button2 = $(filterButtonSelector)[0];
    if(button) {
        console.log('Adjusting buttons');
        button.onclick = async function () {
            await new Promise(function (resolve) {
                setTimeout(resolve, 2000)
            });
            adjustButtons(); //register event handler on fresh button;
            await enrichDetails();
        };
        button2.onclick = button.onclick;
    }
}

function translateString(input) {
    return input.replace('online-zavody','onlinerace').replace('virtuelle-strecken','onlinerace');
}


(async () => {
    await filterRegistrations();
    await enrichDetails(); //enrich details on already loaded page
    adjustButtons(); //enrich them after each next button click
})();
