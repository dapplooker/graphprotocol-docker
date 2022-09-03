
class SesClient {
    private sesConnectionInstance: SES;

    public constructor() {
    }

    public async send(from_email: string, to: string[], subject: string, htmlBody: string, textBody: string): Promise<SuccessResponse|ErrorResponse> {
        const oThis = this;
        Logger.info(`SesClient::send::to: ${to}, subjet: ${subject}, htmlbody: ${htmlBody}, textBody: ${textBody}`);
        const emailParams: any = {
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
            await oThis.getConnectionInstance().sendEmail(emailParams, (err, data) => {
                if (err) {
                    Logger.info(`SesClient::send::Ses: Error sending email response: ${err}, ${err.stack}`);
                    const debugOptions = {
                        error: `Ses: Error sending email. Exception: ${err}`,
                        input: { fromEmail: from_email, to, subject },
                        errorCode: 's_l_a_sc_1',
                    };
                    return ResponseHelper.error(['generalError'], debugOptions);
                }
                Logger.info(`SesClient::send::Successful email response: ${JSON.stringify(data)}`);
                return ResponseHelper.success({});
            });
        } catch (e) {
            Logger.error(`Ses::send::Error sending email. Exception: ${e.message}`);
            const debugOptions = {
                error: `Ses: Error sending email. Exception: ${e.message}`,
                input: { fromEmail: from_email, to, subject },
            };
            return ResponseHelper.error(['generalError'], debugOptions);
        }
        return ResponseHelper.success({});
    }

    private getConnectionInstance(): SES {
        const oThis = this;
        if (GeneralValidator.validateNonEmptyObject(oThis.sesConnectionInstance)) {
            return oThis.sesConnectionInstance;
        }

        const sesConnectionInstance = new AWS.SES({
            apiVersion: '2010-12-01',
            credentials: new AWS.Credentials(Constant.sesConfig.aws_access_key, Constant.sesConfig.aws_secret_key),
            region: Constant.sesConfig.region,
        });
        return sesConnectionInstance;
    }
}

export default new SesClient();
