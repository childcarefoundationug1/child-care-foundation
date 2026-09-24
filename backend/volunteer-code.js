const crypto = require("crypto");

function generateVolunteerAccessCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    function randomBlock(length) {
        let block = "";

        for (let i = 0; i < length; i++) {
            const index = crypto.randomInt(
                0,
                characters.length
            );

            block += characters[index];
        }

        return block;
    }

    return `CCF-${randomBlock(4)}-${randomBlock(4)}`;
}

module.exports = {
    generateVolunteerAccessCode
};
