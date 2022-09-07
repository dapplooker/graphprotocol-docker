class Constant {
    get amazonSESConfig() {
        return {
            accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
            accessSecretKey: process.env.AWS_SES_ACCESS_SECRET_KEY,
            region: process.env.AWS_SES_REGION,
        };
    }

    get SESMailDetails() {
        return {
            fromMail: process.env.FROM_MAIL,
            toMails: [process.env.TO_EMAILS]
        };
    }

    get cronJobSchedule() {
        return "* */15 * * * *";
    }
}

export default new Constant();
