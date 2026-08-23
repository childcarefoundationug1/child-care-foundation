const fs = require("fs");
const path = require("path");

const databaseFile =
    path.join(__dirname, "donations.json");


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
function updateVolunteer(id, updates) {

    const volunteers = readVolunteers();

    const index =
        volunteers.findIndex(
            volunteer => volunteer.id === id
        );

    if (index === -1) {
        return null;
    }

    volunteers[index] = {
        ...volunteers[index],
        ...updates
    };

    saveVolunteers(volunteers);

    return volunteers[index];
}

module.exports = {

    readDonations,

    saveDonations,

    addDonation,

    findDonation,

    updateDonation,

    readVolunteers,

    saveVolunteers,

    addVolunteer,

    updateVolunteer

};
const VOLUNTEERS_FILE = path.join(__dirname, "volunteers.json");

function readVolunteers() {
    if (!fs.existsSync(VOLUNTEERS_FILE)) {
        fs.writeFileSync(VOLUNTEERS_FILE, "[]");
    }

    return JSON.parse(
        fs.readFileSync(VOLUNTEERS_FILE, "utf8")
    );
}

function saveVolunteers(volunteers) {
    fs.writeFileSync(
        VOLUNTEERS_FILE,
        JSON.stringify(volunteers, null, 2)
    );
}

function addVolunteer(volunteer) {
    const volunteers = readVolunteers();

    volunteer.id = Date.now().toString();
    volunteer.status = "pending";
    volunteer.created_at = new Date().toISOString();

    volunteers.push(volunteer);

    saveVolunteers(volunteers);

    return volunteer;
}
