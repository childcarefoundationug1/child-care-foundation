const fs = require("fs");
const path = require("path");

const uploadsDir =
    process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const databaseFile =
    path.join(uploadsDir, "donations.json");


function readDonations() {

    try {

        if (!fs.existsSync(databaseFile)) {

            fs.writeFileSync(
                databaseFile,
                "[]",
                "utf8"
            );

        }


        const data =
            fs.readFileSync(
                databaseFile,
                "utf8"
            );


        return JSON.parse(data);

    } catch (error) {

        console.error(
            "Database read error:",
            error
        );

        return [];

    }

}


function saveDonations(donations) {

    fs.writeFileSync(

        databaseFile,

        JSON.stringify(
            donations,
            null,
            2
        ),

        "utf8"

    );

}


function addDonation(donation) {

    const donations =
        readDonations();


    donations.push(donation);


    saveDonations(
        donations
    );


    return donation;

}


function findDonation(reference) {

    const donations =
        readDonations();


    return donations.find(
        donation =>
            donation.reference === reference
    );

}


/*
UPDATE DONATION
*/

function updateDonation(
    reference,
    updates
) {

    const donations =
        readDonations();


    const index =
        donations.findIndex(
            donation =>
                donation.reference === reference
        );


    if (index === -1) {

  
      return null;

    }


    donations[index] = {

        ...donations[index],

        ...updates,

        updated_at:
            new Date().toISOString()

    };


    saveDonations(
        donations
    );


    return donations[index];

}
module.exports = {

    readDonations,

    saveDonations,

    addDonation,

    findDonation,

    updateDonation

};

const campaignFile = path.join(uploadsDir, "campaign.json");

function readCampaign() {
    try {
        if (!fs.existsSync(campaignFile)) {
            const initial = {
                title: "Support Child Care Foundation",
                reason: "Help us provide essential support to vulnerable children and families.",
                targetAmount: 30000000,
                active: true
            };

            fs.writeFileSync(
                campaignFile,
                JSON.stringify(initial, null, 2),
                "utf8"
            );

            return initial;
        }

        return JSON.parse(
            fs.readFileSync(campaignFile, "utf8")
        );
    } catch (error) {
        console.error("Campaign read error:", error);
        return {
            title: "Support Child Care Foundation",
            reason: "",
            targetAmount: 30000000,
            active: true
        };
    }
}

function saveCampaign(campaign) {
    fs.writeFileSync(
        campaignFile,
        JSON.stringify(campaign, null, 2),
        "utf8"
    );

    return campaign;
}

module.exports.readCampaign = readCampaign;
module.exports.saveCampaign = saveCampaign;

const storiesFile = path.join(uploadsDir, "stories.json");

function readStories() {
    try {
        if (!fs.existsSync(storiesFile)) {
            fs.writeFileSync(
                storiesFile,
                "[]",
                "utf8"
            );
        }

        return JSON.parse(
            fs.readFileSync(storiesFile, "utf8")
        );
    } catch (error) {
        console.error("Stories read error:", error);
        return [];
    }
}

function saveStories(stories) {
    fs.writeFileSync(
        storiesFile,
        JSON.stringify(stories, null, 2),
        "utf8"
    );

    return stories;
}

module.exports.readStories = readStories;
module.exports.saveStories = saveStories;

const eventsFile = path.join(uploadsDir, "events.json");

function readEvents() {
    try {
        if (!fs.existsSync(eventsFile)) {
            fs.writeFileSync(
                eventsFile,
                "[]",
                "utf8"
            );
        }

        return JSON.parse(
            fs.readFileSync(eventsFile, "utf8")
        );
    } catch (error) {
        console.error("Events read error:", error);
        return [];
    }
}

function saveEvents(events) {
    fs.writeFileSync(
        eventsFile,
        JSON.stringify(events, null, 2),
        "utf8"
    );

    return events;
}

module.exports.readEvents = readEvents;
module.exports.saveEvents = saveEvents;
