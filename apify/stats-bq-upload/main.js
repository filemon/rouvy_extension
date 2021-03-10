// This is the main Node.js source code file of your actor.
// It is referenced from the "scripts" section of the package.json file,
// so that it can be started by running "npm start".

// Import Apify SDK. For more information, see https://sdk.apify.com/
const Apify = require('apify');
const fetch = require('node-fetch');

const {BigQuery} = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

function minutesToHours(n) {
    let num = n;
    let hours = (num / 60).toFixed(2);
    return hours;
}

function rouvyTimeToMinutes(hoursString) {
    let parsed = hoursString.split(':');
    return Number.parseInt(parsed[0])*60 + Number.parseInt(parsed[1]);
}

function rouvyTimeToHours(hoursString) {
    return minutesToHours(rouvyTimeToMinutes(hoursString));
}

function transformUser(user,date) {
    let user_name = Object.keys(user)[0];
    let ret = user[user_name];
    ret.time = date;
    ret.name = user_name;
    ret.tss = Number.parseFloat(ret.tss);
    ret.distance = Number.parseFloat(ret.distance.split(/\s/)[0]); //get rid of UOMs
    ret.hours = Number.parseFloat(rouvyTimeToHours(ret.hours)); //get rid of rouvy hour string
    ret.gender = ret.gender.trim();
    ret.age = ret.age.trim();
    return ret;
}

async function getRuns(token) {
    let response = await fetch(
        `https://api.apify.com/v2/acts/filemon~rouvy-stats/runs?token=${token}`, {
            headers: {
                'Accept': 'application/json'
            }
        });

    return await response.json();
}


Apify.main(async () => {
    const input = await Apify.getInput();

    let runs = await getRuns(process.env['APIFY_TOKEN']);
    for(let i = 0;i< runs.data.items.length;i++) {
        let run = runs.data.items[i];
        let dataset = await Apify.openDataset(run.defaultDatasetId);
        let date = new Date(run.startedAt);
        let startDate = new Date(2021, 1, 27,23);
        if (date.getTime() > startDate.getTime()) {
            console.log(dataset.id);
            console.log(date);
            let filemon_inserted = false;
            let rows = await dataset.reduce((result, element,index) => {
                if(Object.keys(element)[0] === 'filemon' && filemon_inserted) {
                    console.log('Skipping filemon');
                } else {
                    if(Object.keys(element)[0] === 'filemon') {
                        filemon_inserted = true;
                    }
                    result.push(transformUser(element, date));
                }

                return result;
            },[]);
            if (rows.length > 0) {
                console.log(`Inserting ${rows.length}`);
                // Load data from a local file into the table
                const [job] = await bigquery
                    .dataset('rouvy')
                    .table('daily_stats')
                    .insert(rows);
            }
        }
        ;
    }

});
