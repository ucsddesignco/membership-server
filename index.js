const bodyParser = require('body-parser');
const compression = require('compression');
const cors = require('cors');
const express = require('express');
const google = require('googleapis');
const googleAuth = require('google-auth-library');
const helmet = require('helmet');
const logger = require('morgan');
const Mailgun = require('mailgun-js');
const mongoose = require('mongoose');
const qr = require('qr-image');
const uuidv1 = require('uuid/v1');

const Member = require('./models/Member');

// Add environment variables from .env file if running
// locally
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const AWS = require('aws-sdk');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/spreadsheets',
];

const S3_BUCKET = 'datu-membership';
const MAILGUN_DOMAIN = 'mg.designatucsd.org';
const FROM_EMAIL = 'membership@designatucsd.org';
const DB_URI = process.env.DB_URI;
const PORT = process.env.PORT || 8080;

mongoose.connect(DB_URI);
mongoose.Promise = global.Promise;

// Setup Node.js App
const app = express();
app.use(helmet());
app.use(compression());
app.use(logger('dev'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.disable('x-powered-by');
app.enable('trust proxy');

app.get('/', (req, res) => {
  res.send('Server is listening');
});

// app.get('/members', (req, res) => {

// });

app.post('/members', async (req, res) => {
  const { email, name } = req.body;
  const s3 = new AWS.S3({ apiVersion: '2006-03-01' });

  // Generate QR code image
  const image = qr.imageSync(email, { type: 'png' });
  // Generate a unique id for the image key
  const id = uuidv1();
  const key = `${email}-${id}.png`;
  try {
    let uploadParams = {
      Bucket: S3_BUCKET,
      ACL: 'public-read',
      Key: key,
      Body: image,
    };
    const data = await s3.upload(uploadParams).promise();
    const qrUrl = data.Location;
    console.log(`Email: ${email}`);
    console.log(`QR: ${qrUrl}`);

    // Mailgun configuration
    const mailgun = new Mailgun({
      apiKey: process.env.MAILGUN_API_KEY,
      domain: MAILGUN_DOMAIN,
    });
    const memberFirstName = name.split(' ')[0];
    const emailInfo = {
      from: FROM_EMAIL,
      to: email,
      subject: 'Design at UCSD Membership',
      html: generateHTMLBody(memberFirstName, qrUrl),
    }

    // Send Email
    mailgun.messages().send(emailInfo, (err, body) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: 'Could not send email' });
      }

      const newMember = new Member({
        email,
        qrUrl,
        emailSent: true,
      });
      
      // Save new member info to the DB
      newMember.save((err) => {
        if (err) {
          return res.status(500).json({ message: 'Could not save new member' });
        }
  
        // Add Member to mailing list
        const members = [
          {
            address: email,
          }
        ];
        mailgun.lists('membership@mg.designatucsd.org').members().add({ members, subscribed: true }, (err, body) => {
          if (err) {
            console.log(`Failed to add ${email} to mailing list`);
          }
          return res.status(201).json(newMember);
        });
      });
    })
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: 'Failed to upload QR code' });
  }
});

// app.post('/generate', (req, res) => {
//   // req.body should have token, spreadsheetId, startRow, qrCol
//   const { token, spreadsheetId, startRow, qrCol } = req.body;

//   // Check to make sure all fields provided
//   if (!token || !spreadsheetId || !startRow || !qrCol) {
//     return res.status(400).json({ error: 'Make sure all fields are provided' });
//   }

//   const clientSecret = process.env.CLIENT_SECRET;
//   const clientId = process.env.CLIENT_ID;
//   const auth = new googleAuth();
//   const oauth2Client = new auth.OAuth2(clientId, clientSecret);
//   oauth2Client.credentials = token;
//   return generateQRUrls(oauth2Client, res.body, res);
// });

app.listen(PORT, (err ) => {
  if (err) {
    console.log(err);
  }
  console.info(`Server running on PORT: ${PORT}`);
});


function generateHTMLBody(firstName, qrUrl) {
  return `<!DOCTYPE HTML PUBLIC "-//W3C//DTD XHTML 1.0 Transitional //EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head>
      <!--[if gte mso 9]><xml>
        <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml><![endif]-->
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <meta name="viewport" content="width=device-width">
      <!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]-->
      <title></title>
      <!--[if !mso]><!-- -->
    <link href="https://fonts.googleapis.com/css?family=Montserrat" rel="stylesheet" type="text/css">
    <link href="https://fonts.googleapis.com/css?family=Open+Sans" rel="stylesheet" type="text/css">
    <!--<![endif]-->
      
      <style type="text/css" id="media-query">
        body {
    margin: 0;
    padding: 0; }

  table, tr, td {
    vertical-align: top;
    border-collapse: collapse; }

  .ie-browser table, .mso-container table {
    table-layout: fixed; }

  * {
    line-height: inherit; }

  a[x-apple-data-detectors=true] {
    color: inherit !important;
    text-decoration: none !important; }

  [owa] .img-container div, [owa] .img-container button {
    display: block !important; }

  [owa] .fullwidth button {
    width: 100% !important; }

  [owa] .block-grid .col {
    display: table-cell;
    float: none !important;
    vertical-align: top; }

  .ie-browser .num12, .ie-browser .block-grid, [owa] .num12, [owa] .block-grid {
    width: 500px !important; }

  .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div {
    line-height: 100%; }

  .ie-browser .mixed-two-up .num4, [owa] .mixed-two-up .num4 {
    width: 164px !important; }

  .ie-browser .mixed-two-up .num8, [owa] .mixed-two-up .num8 {
    width: 328px !important; }

  .ie-browser .block-grid.two-up .col, [owa] .block-grid.two-up .col {
    width: 250px !important; }

  .ie-browser .block-grid.three-up .col, [owa] .block-grid.three-up .col {
    width: 166px !important; }

  .ie-browser .block-grid.four-up .col, [owa] .block-grid.four-up .col {
    width: 125px !important; }

  .ie-browser .block-grid.five-up .col, [owa] .block-grid.five-up .col {
    width: 100px !important; }

  .ie-browser .block-grid.six-up .col, [owa] .block-grid.six-up .col {
    width: 83px !important; }

  .ie-browser .block-grid.seven-up .col, [owa] .block-grid.seven-up .col {
    width: 71px !important; }

  .ie-browser .block-grid.eight-up .col, [owa] .block-grid.eight-up .col {
    width: 62px !important; }

  .ie-browser .block-grid.nine-up .col, [owa] .block-grid.nine-up .col {
    width: 55px !important; }

  .ie-browser .block-grid.ten-up .col, [owa] .block-grid.ten-up .col {
    width: 50px !important; }

  .ie-browser .block-grid.eleven-up .col, [owa] .block-grid.eleven-up .col {
    width: 45px !important; }

  .ie-browser .block-grid.twelve-up .col, [owa] .block-grid.twelve-up .col {
    width: 41px !important; }

  @media only screen and (min-width: 520px) {
    .block-grid {
      width: 500px !important; }
    .block-grid .col {
      vertical-align: top; }
      .block-grid .col.num12 {
        width: 500px !important; }
    .block-grid.mixed-two-up .col.num4 {
      width: 164px !important; }
    .block-grid.mixed-two-up .col.num8 {
      width: 328px !important; }
    .block-grid.two-up .col {
      width: 250px !important; }
    .block-grid.three-up .col {
      width: 166px !important; }
    .block-grid.four-up .col {
      width: 125px !important; }
    .block-grid.five-up .col {
      width: 100px !important; }
    .block-grid.six-up .col {
      width: 83px !important; }
    .block-grid.seven-up .col {
      width: 71px !important; }
    .block-grid.eight-up .col {
      width: 62px !important; }
    .block-grid.nine-up .col {
      width: 55px !important; }
    .block-grid.ten-up .col {
      width: 50px !important; }
    .block-grid.eleven-up .col {
      width: 45px !important; }
    .block-grid.twelve-up .col {
      width: 41px !important; } }

  @media (max-width: 520px) {
    .block-grid, .col {
      min-width: 320px !important;
      max-width: 100% !important;
      display: block !important; }
    .block-grid {
      width: calc(100% - 40px) !important; }
    .col {
      width: 100% !important; }
      .col > div {
        margin: 0 auto; }
    img.fullwidth, img.fullwidthOnMobile {
      max-width: 100% !important; }
    .no-stack .col {
      min-width: 0 !important;
      display: table-cell !important; }
    .no-stack.two-up .col {
      width: 50% !important; }
    .no-stack.mixed-two-up .col.num4 {
      width: 33% !important; }
    .no-stack.mixed-two-up .col.num8 {
      width: 66% !important; }
    .no-stack.three-up .col.num4 {
      width: 33% !important; }
    .no-stack.four-up .col.num3 {
      width: 25% !important; }
    .mobile_hide {
      min-height: 0px;
      max-height: 0px;
      max-width: 0px;
      display: none;
      overflow: hidden;
      font-size: 0px; } }

      </style>
  </head>
  <body class="clean-body" style="margin: 0;padding: 0;-webkit-text-size-adjust: 100%;background-color: #FFFFFF">
    <style type="text/css" id="media-query-bodytag">
      @media (max-width: 520px) {
        .block-grid {
          min-width: 320px!important;
          max-width: 100%!important;
          width: 100%!important;
          display: block!important;
        }

        .col {
          min-width: 320px!important;
          max-width: 100%!important;
          width: 100%!important;
          display: block!important;
        }

          .col > div {
            margin: 0 auto;
          }

        img.fullwidth {
          max-width: 100%!important;
        }
        img.fullwidthOnMobile {
          max-width: 100%!important;
        }
        .no-stack .col {
          min-width: 0!important;
          display: table-cell!important;
        }
        .no-stack.two-up .col {
          width: 50%!important;
        }
        .no-stack.mixed-two-up .col.num4 {
          width: 33%!important;
        }
        .no-stack.mixed-two-up .col.num8 {
          width: 66%!important;
        }
        .no-stack.three-up .col.num4 {
          width: 33%!important;
        }
        .no-stack.four-up .col.num3 {
          width: 25%!important;
        }
        .mobile_hide {
          min-height: 0px!important;
          max-height: 0px!important;
          max-width: 0px!important;
          display: none!important;
          overflow: hidden!important;
          font-size: 0px!important;
        }
      }
    </style>
    <!--[if IE]><div class="ie-browser"><![endif]-->
    <!--[if mso]><div class="mso-container"><![endif]-->
    <table class="nl-container" style="border-collapse: collapse;table-layout: fixed;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;vertical-align: top;min-width: 320px;Margin: 0 auto;background-color: #FFFFFF;width: 100%" cellpadding="0" cellspacing="0">
    <tbody>
    <tr style="vertical-align: top">
      <td style="word-break: break-word;border-collapse: collapse !important;vertical-align: top">
      <!--[if (mso)|(IE)]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background-color: #FFFFFF;"><![endif]-->

      <div style="background-color:transparent;">
        <div style="Margin: 0 auto;min-width: 320px;max-width: 500px;overflow-wrap: break-word;word-wrap: break-word;word-break: break-word;background-color: transparent;" class="block-grid ">
          <div style="border-collapse: collapse;display: table;width: 100%;background-color:transparent;">
            <!--[if (mso)|(IE)]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:transparent;" align="center"><table cellpadding="0" cellspacing="0" border="0" style="width: 500px;"><tr class="layout-full-width" style="background-color:transparent;"><![endif]-->

                <!--[if (mso)|(IE)]><td align="center" width="500" style=" width:500px; padding-right: 0px; padding-left: 0px; padding-top:5px; padding-bottom:5px; border-top: 0px solid transparent; border-left: 0px solid transparent; border-bottom: 0px solid transparent; border-right: 0px solid transparent;" valign="top"><![endif]-->
              <div class="col num12" style="min-width: 320px;max-width: 500px;display: table-cell;vertical-align: top;">
                <div style="background-color: transparent; width: 100% !important;">
                <!--[if (!mso)&(!IE)]><!--><div style="border-top: 0px solid transparent; border-left: 0px solid transparent; border-bottom: 0px solid transparent; border-right: 0px solid transparent; padding-top:5px; padding-bottom:5px; padding-right: 0px; padding-left: 0px;"><!--<![endif]-->



                    
                    
                      <div align="center" class="img-container center  autowidth  fullwidth " style="padding-right: 30px;  padding-left: 30px;">
  <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr style="line-height:0px;line-height:0px;"><td style="padding-right: 30px; padding-left: 30px;" align="center"><![endif]-->
  <div style="line-height:30px;font-size:1px">&#160;</div>  <img class="center  autowidth  fullwidth" align="center" border="0" src="https://i.imgur.com/OZorPOF.png" alt="Image" title="Image" style="outline: none;text-decoration: none;-ms-interpolation-mode: bicubic;clear: both;display: block !important;border: 0;height: auto;float: none;width: 100%;max-width: 440px" width="440">
  <div style="line-height:30px;font-size:1px">&#160;</div><!--[if mso]></td></tr></table><![endif]-->
  </div>

                    
                    
                      <div class="">
    <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right: 10px; padding-left: 10px; padding-top: 10px; padding-bottom: 10px;"><![endif]-->
    <div style="color:#555555;line-height:120%;font-family:'Open Sans', Helvetica, Arial, sans-serif; padding-right: 10px; padding-left: 10px; padding-top: 10px; padding-bottom: 10px;">	
      <div style="font-size:12px;line-height:14px;font-family:'Open Sans', Helvetica, Arial, sans-serif;color:#555555;text-align:left;"><p style="margin: 0;font-size: 14px;line-height: 17px"><span style="font-size: 18px; line-height: 21px;">Hey ${firstName}!</span><br><br><span style="font-size: 18px; line-height: 21px;">Thank you for signing up to be a member of our community! Here's a QR Code that you can use to check in at future events:</span></p><br><img src="${qrUrl}" alt="QR Code"></div>	
    </div>
    <!--[if mso]></td></tr></table><![endif]-->
  </div>
                    
                <!--[if (!mso)&(!IE)]><!--></div><!--<![endif]-->
                </div>
              </div>
            <!--[if (mso)|(IE)]></td></tr></table></td></tr></table><![endif]-->
          </div>
        </div>
      </div>    <div style="background-color:#5ACEE1;">
        <div style="Margin: 0 auto;min-width: 320px;max-width: 500px;overflow-wrap: break-word;word-wrap: break-word;word-break: break-word;background-color: transparent;" class="block-grid ">
          <div style="border-collapse: collapse;display: table;width: 100%;background-color:transparent;">
            <!--[if (mso)|(IE)]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#5ACEE1;" align="center"><table cellpadding="0" cellspacing="0" border="0" style="width: 500px;"><tr class="layout-full-width" style="background-color:transparent;"><![endif]-->

                <!--[if (mso)|(IE)]><td align="center" width="500" style=" width:500px; padding-right: 0px; padding-left: 0px; padding-top:0px; padding-bottom:0px; border-top: 0px solid transparent; border-left: 0px solid transparent; border-bottom: 0px solid transparent; border-right: 0px solid transparent;" valign="top"><![endif]-->
              <div class="col num12" style="min-width: 320px;max-width: 500px;display: table-cell;vertical-align: top;">
                <div style="background-color: transparent; width: 100% !important;">
                <!--[if (!mso)&(!IE)]><!--><div style="border-top: 0px solid transparent; border-left: 0px solid transparent; border-bottom: 0px solid transparent; border-right: 0px solid transparent; padding-top:0px; padding-bottom:0px; padding-right: 0px; padding-left: 0px;"><!--<![endif]-->

                    
                      
  <table border="0" cellpadding="0" cellspacing="0" width="100%" class="divider " style="border-collapse: collapse;table-layout: fixed;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;vertical-align: top;min-width: 100%;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%">
      <tbody>
          <tr style="vertical-align: top">
              <td class="divider_inner" style="word-break: break-word;border-collapse: collapse !important;vertical-align: top;padding-right: 0px;padding-left: 0px;padding-top: 0px;padding-bottom: 0px;min-width: 100%;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%">
                  <table class="divider_content" align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;table-layout: fixed;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;vertical-align: top;border-top: 0px solid transparent;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%">
                      <tbody>
                          <tr style="vertical-align: top">
                              <td style="word-break: break-word;border-collapse: collapse !important;vertical-align: top;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%">
                                  <span></span>
                              </td>
                          </tr>
                      </tbody>
                  </table>
              </td>
          </tr>
      </tbody>
  </table>
                    
                <!--[if (!mso)&(!IE)]><!--></div><!--<![endif]-->
                </div>
              </div>
            <!--[if (mso)|(IE)]></td></tr></table></td></tr></table><![endif]-->
          </div>
        </div>
      </div>    <div style="background-color:#DF2F41;">
        <div style="Margin: 0 auto;min-width: 320px;max-width: 500px;overflow-wrap: break-word;word-wrap: break-word;word-break: break-word;background-color: #DF2F41;" class="block-grid ">
          <div style="border-collapse: collapse;display: table;width: 100%;background-color:#DF2F41;">
            <!--[if (mso)|(IE)]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#DF2F41;" align="center"><table cellpadding="0" cellspacing="0" border="0" style="width: 500px;"><tr class="layout-full-width" style="background-color:#DF2F41;"><![endif]-->

                <!--[if (mso)|(IE)]><td align="center" width="500" style=" width:500px; padding-right: 0px; padding-left: 0px; padding-top:5px; padding-bottom:5px; border-top: 0px solid #5ACEE1; border-left: 0px solid transparent; border-bottom: 0px solid transparent; border-right: 0px solid transparent;" valign="top"><![endif]-->
              <div class="col num12" style="min-width: 320px;max-width: 500px;display: table-cell;vertical-align: top;">
                <div style="background-color: transparent; width: 100% !important;">
                <!--[if (!mso)&(!IE)]><!--><div style="border-top: 0px solid #5ACEE1; border-left: 0px solid transparent; border-bottom: 0px solid transparent; border-right: 0px solid transparent; padding-top:5px; padding-bottom:5px; padding-right: 0px; padding-left: 0px;"><!--<![endif]-->

                    
                      
  <div align="center" style="padding-right: 25px; padding-left: 25px; padding-bottom: 25px;" class="">
    <div style="line-height:25px;font-size:1px">&#160;</div>
    <div style="display: table; max-width:191px;">
    <!--[if (mso)|(IE)]><table width="141" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-collapse:collapse; padding-right: 25px; padding-left: 25px; padding-bottom: 25px;"  align="center"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; mso-table-lspace: 0pt;mso-table-rspace: 0pt; width:141px;"><tr><td width="32" style="width:32px; padding-right: 10px;" valign="top"><![endif]-->
      <table align="left" border="0" cellspacing="0" cellpadding="0" width="32" height="32" style="border-collapse: collapse;table-layout: fixed;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;vertical-align: top;Margin-right: 10px">
        <tbody><tr style="vertical-align: top"><td align="left" valign="middle" style="word-break: break-word;border-collapse: collapse !important;vertical-align: top">
          <a href="https://www.facebook.com/designatucsd" title="Facebook" target="_blank">
            <img src="https://i.imgur.com/ya3ERE2.png" alt="Facebook" title="Facebook" width="32" style="outline: none;text-decoration: none;-ms-interpolation-mode: bicubic;clear: both;display: block !important;border: none;height: auto;float: none;max-width: 32px !important">
          </a>
        <div style="line-height:5px;font-size:1px">&#160;</div>
        </td></tr>
      </tbody></table>
        <!--[if (mso)|(IE)]></td><td width="32" style="width:32px; padding-right: 10px;" valign="top"><![endif]-->
      <table align="left" border="0" cellspacing="0" cellpadding="0" width="32" height="32" style="border-collapse: collapse;table-layout: fixed;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;vertical-align: top;Margin-right: 10px">
        <tbody><tr style="vertical-align: top"><td align="left" valign="middle" style="word-break: break-word;border-collapse: collapse !important;vertical-align: top">
          <a href="https://www.instagram.com/designatucsd/" title="Instagram" target="_blank">
            <img src="https://i.imgur.com/wDf6d4b.png" alt="Instagram" title="Instagram" width="32" style="outline: none;text-decoration: none;-ms-interpolation-mode: bicubic;clear: both;display: block !important;border: none;height: auto;float: none;max-width: 32px !important">
          </a>
        <div style="line-height:5px;font-size:1px">&#160;</div>
        </td></tr>
      </tbody></table>
        <!--[if (mso)|(IE)]></td><td width="32" style="width:32px; padding-right: 0;" valign="top"><![endif]-->
      <table align="left" border="0" cellspacing="0" cellpadding="0" width="32" height="32" style="border-collapse: collapse;table-layout: fixed;border-spacing: 0;mso-table-lspace: 0pt;mso-table-rspace: 0pt;vertical-align: top;Margin-right: 0">
        <tbody><tr style="vertical-align: top"><td align="left" valign="middle" style="word-break: break-word;border-collapse: collapse !important;vertical-align: top">
          <a href="https://www.linkedin.com/company-beta/17891459" title="LinkedIn" target="_blank">
            <img src="https://i.imgur.com/immYzys.png" alt="LinkedIn" title="LinkedIn" width="32" style="outline: none;text-decoration: none;-ms-interpolation-mode: bicubic;clear: both;display: block !important;border: none;height: auto;float: none;max-width: 32px !important">
          </a>
        <div style="line-height:5px;font-size:1px">&#160;</div>
        </td></tr>
      </tbody></table>
      <!--[if (mso)|(IE)]></td></tr></table></td></tr></table><![endif]-->
    </div>
  </div>
                    
                <!--[if (!mso)&(!IE)]><!--></div><!--<![endif]-->
                </div>
              </div>
            <!--[if (mso)|(IE)]></td></tr></table></td></tr></table><![endif]-->
          </div>
        </div>
      </div>   <!--[if (mso)|(IE)]></td></tr></table><![endif]-->
      </td>
    </tr>
    </tbody>
    </table>
    <!--[if (mso)|(IE)]></div><![endif]-->


  </body></html>`
}
