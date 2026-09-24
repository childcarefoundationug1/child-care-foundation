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
