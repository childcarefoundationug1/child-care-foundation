const supabase = require("./supabase");

async function ensureVolunteerDocumentsBucket() {
    const bucketName = "volunteer-documents";

    const { data: buckets, error } =
        await supabase.storage.listBuckets();

    if (error) {
        throw new Error(
            `Unable to check Supabase Storage: ${error.message}`
        );
    }

    const exists = buckets.some(
        bucket => bucket.name === bucketName
    );

    if (exists) {
        console.log(
            `Supabase Storage bucket "${bucketName}" already exists.`
        );
        return;
    }

    const { error: createError } =
        await supabase.storage.createBucket(
            bucketName,
            {
                public: false,
                fileSizeLimit: "10MB"
            }
        );

    if (createError) {
        throw new Error(
            `Unable to create Storage bucket: ${createError.message}`
        );
    }

    console.log(
        `Created private Supabase Storage bucket "${bucketName}".`
    );
}

module.exports = {
    ensureVolunteerDocumentsBucket
};
