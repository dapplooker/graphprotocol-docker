import Constant from './config/constants.js';
import AWS from 'aws-sdk';


export class SesClient {
    constructor() {}

    send(from_email, to, subject, htmlBody, textBody) {
        const oThis = this;
        console.log(`SesClient::send::to: ${to}, subject: ${subject}, htmlbody: ${htmlBody}, textBody: ${textBody}`);
        const emailParams = {
            Source: from_email,
            Destination: {
                ToAddresses: to,
            },
            Message: {
                Body: {
                    Html: {
                        Charset: 'UTF-8',
                        Data: htmlBody,
                    },
                    Text: {
                        Charset: 'UTF-8',
                        Data: textBody,
                    },
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: subject,
                },
            },
        };

        try {
            oThis.getConnectionInstance().sendEmail(emailParams, (err, data) => {
                if (err) {
                    console.log(`SesClient::send::Ses: Error sending email response: ${err}, ${err.stack}`);
                    const debugOptions = {
                        error: `Ses: Error sending email. Exception: ${err}`,
                        input: { fromEmail: from_email, to, subject },
                        errorCode: 's_l_a_sc_1',
                    };
                    console.log(`Error sending mail: ${debugOptions}`);
                    return
                }
                console.log(`SesClient::send::Successful email response: ${JSON.stringify(data)}`);
            });
        } catch (e) {
            console.log(`Ses::send::Error sending email. Exception: ${e.message}`);
            const debugOptions = {
                error: `Ses: Error sending email. Exception: ${e.message}`,
                input: {fromEmail: from_email, to, subject},
            };
            console.log(`Error sending mail: ${debugOptions}`);
        }
    }

     getConnectionInstance() {
        return new AWS.SES({
            apiVersion: '2010-12-01',
            credentials: new AWS.Credentials(Constant.amazonSESConfig.accessKeyId,
                Constant.amazonSESConfig.accessSecretKey),
            region: Constant.amazonSESConfig.region,
        });
    }
}
