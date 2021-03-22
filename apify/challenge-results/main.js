/**
 * This template is a production ready boilerplate for developing with `PuppeteerCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

const Apify = require('apify');

const site = 'https://my.rouvy.com';
const { utils: { log } } = Apify;
const {BigQuery} = require('@google-cloud/bigquery');
const fs = require('fs');


async function preventPopup(page) {
    await page.setCookie(...[{
        name: 'popupBanner18',
        value: "true",
        domain: '.rouvy.com',
        url: site
    }]);
}

async function scrapeStats(page, number_of_pages,dataset) {
//    await page.evaluate(()=>document.querySelector('div.tabcont.results').click());
//    await page.click('div.tabcont.results');
    await scrapeStatsPage(page,dataset);
    // scrape paginated challenge results
    for (let i = 2; i < number_of_pages + 1; i++) {
        log.info('Scraping page' + i);
        await Promise.all([
            page.evaluate(()=>document.querySelector('a.ajax.bold.next').click()),
            page.waitForResponse(response => {
                return response.request().url().startsWith(site);
            })
        ]);
        await scrapeStatsPage(page,dataset);
    }
}

async function scrapeStatsPage(page,dataset) {
    let stats = await page.evaluate(() => {
        let users = $('div.resultCont tbody tr').map(function () {
            let user = $(this).find('a').text();
            let hours = $($(this).children()[3]).text();
            let work = $($(this).children()[4]).text().trim();
            return { [user]: {
                    work: work,
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

function transformUser(user,date) {
    let user_name = Object.keys(user)[0];
    let ret = user[user_name];
    ret.name = user_name;
    ret.time = date;
    ret.hours = Number.parseFloat(rouvyTimeToHours(ret.hours)); //get rid of rouvy hour string
    ret.work = Number.parseInt(ret.work.split(/\s/)[0]); //get rid of UOMs
    return ret;
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
        const [job] = await bigquery
            .dataset('rouvy')
            .table('burn_calories_stats')
            .insert(rows);
    }
}

Apify.main(async () => {
    console.log('Launching Puppeteer...');
    const browser = await Apify.launchPuppeteer();
    const page = await browser.newPage();
    // Store the results to the default dataset.
    const {number_of_stats_pages} = await Apify.getInput();
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
    await preventPopup(page);
    await page.goto(`${site}/challenges/detail/188`);

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
    await scrapeStats(page,number_of_stats_pages,scraped_stats);
    await sendToBigQuery(scraped_stats);
});
