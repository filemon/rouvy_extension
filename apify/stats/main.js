/**
 * This template is a production ready boilerplate for developing with `PuppeteerCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

const Apify = require('apify');
const {utils: {log}} = Apify;
const {BigQuery} = require('@google-cloud/bigquery');
const fs = require('fs');


const site = 'https://my.rouvy.com';
const url = 'https://my.rouvy.com/public-rankings/seasonresults';

async function preventPopup(page) {
    await page.setCookie(...[{
        name: 'popupBanner18',
        value: "true",
        domain: '.rouvy.com',
        url: site
    }]);
}

async function scrapeStats(page, number_of_pages,dataset) {

    await scrapeStatsPage(page,dataset);
    // scrape all pages for given category
    for (let i = 2; i < number_of_pages + 1; i++) {
        log.info('Scraping page' + i);
        await Promise.all([
            page.click(`a.ajax.button[href*="seasonResultsPaginator-page=${i}"]`),
            page.waitForResponse(response => {
                return response.request().url().startsWith(site);
            })
        ]);
        await scrapeStatsPage(page,dataset);
    }
}

async function scrapeStatsPage(page,dataset) {
    let stats = await page.evaluate(() => {
        let users = $('#snippet--seasonResults tr').slice(0,10).map(function () {
            let user = $(this).find('a').text();
            let gender = $(this).children('td.gender').text();
            let age = $(this).children('td.age').text();
            let level = $(this).children('td.levellogo').attr('datavt');
            let tss = $(this).children('td.points').text();
            let distance = $(this).children('td.distance').text();
            let hours = $(this).children('td.duration').text();
            let country = $(this).find('img.flagIco').attr('datavt');
            return { [user]: {
                        gender: gender,
                        age: age,
                        country: country,
                        level: level,
                        tss: tss,
                        distance: distance,
                        hours: hours
                }};
        });
        return users.get();
    });
    let promises = [];
    stats.forEach(element => {
        promises.push(dataset.pushData(element));
    });
    await Promise.all(promises);
    console.log('Scraping done');
}

function diffDistance(newDistance, previousDistance) {
    return parseFloat(newDistance) - parseFloat(previousDistance);
}

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

function diffTimes(newTime, previousTime) {
    let prevTimeTrans = previousTime.includes(':') ? rouvyTimeToHours(previousTime):previousTime;
    return Number.parseFloat(newTime) - Number.parseFloat(prevTimeTrans);
}

function calculateIF(tss,time) {
    if(tss === 0) { //no excercise done
        return 0;
    } else {
        return Math.sqrt(tss / (100 * time)).toFixed(4);
    }
}

function copyStats(from,to) {
    to.tss = from.tss;
    to.distance = from.distance.split(/\s/)[0];
    to.hours = from.hours;
    to.intensity = calculateIF(to.tss,to.hours);
    to.date = new Date();
    to.country = from.country;
    return to;
}

function calculateDiffStats(existingStats, newStats) {
    let tss_inc = Number.parseFloat(newStats.tss).toFixed(1) - Number.parseFloat(existingStats.tss).toFixed(1);
    let time_inc = diffTimes(newStats.hours, existingStats.hours);
    let intensity = calculateIF(tss_inc,time_inc);
    return {
        tss_inc: tss_inc.toFixed(1),
        distance_inc: diffDistance(newStats.distance, existingStats.distance).toFixed(2),
        hours_inc: time_inc.toFixed(2),
        tss: newStats.tss,
        distance: newStats.distance,
        hours: newStats.hours,
        intensity: intensity,
        date: new Date()
    };
}

function calculateStatsForPeriod(existingStats,newStats, period, days) {
    let ret = existingStats[period];
    if(!ret) {
        ret = calculateDiffStats(newStats,newStats); // init with empty values
    } else {
        const diffTime = Math.abs(new Date() - new Date(ret.date));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if(diffDays >= days) {
            ret = calculateDiffStats(ret,newStats);
        }
    }
    return ret;
}


async function updateStats(scraped_stats) {
    let rouvy_store = await Apify.openKeyValueStore('rouvy');
    let existing_stats = await rouvy_store.getValue('user_stats');
    const info = await scraped_stats.getInfo();
    console.log('Items: ' + JSON.stringify(info));
    await scraped_stats.forEach(async (item, index) => {
        let user = Object.keys(item);
        let existing_user = existing_stats[user];
        item[user].distance = item[user].distance.split(/\s/)[0]; //get rid of UOMs
        item[user].hours = rouvyTimeToHours(item[user].hours); //get rid of rouvy hour string
        if(existing_user) {
            console.log('Updating ' + user);
            let daily = calculateDiffStats(existing_user,item[user],0);
            copyStats(item[user],existing_user); //copy new values to root
            existing_user.daily = daily;
            ['weekly','monthly'].forEach( (period) => {
                let days = period === 'weekly' ? 7:30;
                let stats = calculateStatsForPeriod(existing_user, item[user], period, days);
                existing_user[period] = stats;
            });
        } else {
            console.log('creating new user ' + user);
            existing_stats[user] = item[user];
        }
    });
    await rouvy_store.setValue('user_stats', existing_stats);
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
    ret.intensity = calculateIF(ret.tss,ret.hours);
    return ret;
}



async function setupCredentialFile() {
    const credentials = process.env.CREDENTIALS;
    const { project_id: projectId } = JSON.parse(credentials);
    console.log('Project ID:', projectId);

    const keyFilename = './credentials.json';
    try {
        await fs.writeFileSync(keyFilename, credentials);
    } catch (err) {
        throw new Error('Error while saving credentials:' + err);
    }
    return new BigQuery({ projectId, keyFilename });

}

async function sendToBigQuery(dataset) {
    const bigquery = await setupCredentialFile();
    let date = new Date();
    console.log(dataset.id);
    console.log(date);
    let rows = await dataset.reduce((result, element,index) => {
        let already_inserted = !! result.find(user => user.name === Object.keys(element)[0]);
        if(!already_inserted) {
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

Apify.main(async () => {
    const {number_of_stats_pages} = await Apify.getInput();

    const browser = await Apify.launchPuppeteer();
    const page = await browser.newPage();
    const scraped_stats = await Apify.openDataset();

    const sessionPool = await Apify.openSessionPool({
        maxPoolSize: 1,
        sessionOptions: {
            maxAgeSecs: 300000, //3 days
            maxUsageCount: 150, // for example when you know that the site blocks after 150 requests.
        },
        persistStateKeyValueStoreId: 'login-sessions',
        persistStateKey: 'SESSION_POOL_STATE'
    });
    // Get random session from the pool
    const session1 = await sessionPool.getSession();
    let stored_cookies = session1.getPuppeteerCookies(site);
    stored_cookies.map(function(e){
        e.url = site;//page.setCookie doesn't set anything if url not present
        e.domain = '.rouvy.com'//page.setCookie doesn't set anything if domain is not full url
    });
    await page.setCookie(...stored_cookies);
    await page.goto(`${site}`);

    page.on('console', consoleObj => console.log(consoleObj.text()));

    const input =  await Apify.getValue('INPUT');

    await page.evaluate(input => {
        if(!$('body.User-dashboard').length) {
            console.log("Logging in");
            $('input[type=\"email\"]').val(input["rouvy_user"]);
            $('input[type=\"password\"]').val(input["rouvy_pass"]);
            $('input[type=\"submit\"]').click();
        } else {
            console.log('Already logged in');
        }
    }, input);
    let page_cookies = await page.cookies();
    await session1.setPuppeteerCookies(page_cookies,site);
    await sessionPool.persistState();
    await new Promise(function(resolve) {setTimeout(resolve, 5000)});


    console.log(`Opening page ${url}...`);

    await preventPopup(page);
    await page.goto(url);
    await scrapeStats(page,Number.parseInt(number_of_stats_pages),scraped_stats);
    await sendToBigQuery(scraped_stats);
    await updateStats(scraped_stats);
    log.info('Crawl finished.');

});
