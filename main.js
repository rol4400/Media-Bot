// Requirements
const { Telegraf } = require('telegraf');
const { google } = require('googleapis');

const drive = google.drive('v3');
const axios = require('axios');

require('dotenv').config();

// Init the Telegraf core class
const bot = new Telegraf(process.env.BOT_TOKEN);

// Upload folder IDs
folderId = process.env.DRIVE_ROOT;

// Debug bool
const DEBUG = false;

/*****************************************************
 * Bot Event Hooks
 ******************************************************/

// Start the bot up
bot.on('photo', async(ctx) => {
    if (DEBUG) ctx.telegram.sendMessage(ctx.message.chat.id, `Photo submitted`);

    try { const files = ctx.update.message.photo; } catch (err) { return; };
    var fileId = files[1].file_id; // Telegram stores various different sizes of the photos. "1" is a large one

    // Get the current date information
    var ts = Date.now();
    var date_ob = new Date(ts);
    var day = date_ob.getDate();
    var month = date_ob.getMonth() + 1;
    var date = "39-" + month + "-" + day;

    // Get the subdirectory ID
    var parent_dir = await getSubDirectory("Photos");

    // Use the file ID to call an axios http request to telegram's api to obtain the image
    try {
        ctx.telegram.getFileLink(fileId).then(downloadUrl => {
            axios({ url: downloadUrl.toString(), responseType: 'stream' }).then(response => {
                return new Promise((resolve, reject) => {

                    // Generate the file name and stream
                    var filename = date + " (" + ctx.update.message.from.first_name + " @ " + ctx.update.message.chat.title + ")" + ".jpg";
                    var stream = response.data;

                    // Upload the file to google drive
                    uploadFile(filename, stream, parent_dir);
                });
            }).catch();
        })
    } catch (err) { }
});

bot.on('video', async (ctx) => {
    if (DEBUG) ctx.telegram.sendMessage(ctx.message.chat.id, `Video submitted`);

    try { const files = ctx.update.message.video; } catch (err) { return; };

    var fileId = files.file_id; // Telegram stores various different sizes of the photos. "1" is a large one
    var fileName = files.file_name;
    var mimeType = files.mime_type;

    // Get the file extension
    var extension = fileName.split(".")[1];

    // Get the current date information
    var ts = Date.now();
    var date_ob = new Date(ts);
    var day = date_ob.getDate();
    var month = date_ob.getMonth() + 1;
    var date = "39-" + month + "-" + day;

    // Get the subdirectory ID
    var parent_dir = await getSubDirectory("Videos");

    // Use the file ID to call an axios http request to telegram's api to obtain the image
    try {
        ctx.telegram.getFileLink(fileId).then(downloadUrl => {
            axios({ url: downloadUrl.toString(), responseType: 'stream' }).then(response => {
                return new Promise((resolve, reject) => {

                    // Generate the file name and stream
                    var fileName = date + " (" + ctx.update.message.from.first_name + " @ " + ctx.update.message.chat.title + ")" + "." + extension;
                    var stream = response.data;

                    // Upload the file to google drive
                    uploadFile(fileName, stream, parent_dir);
                });
            }).catch();
        })
    } catch (err) { }
});

bot.on('document', async (ctx) => {
    if (DEBUG) ctx.telegram.sendMessage(ctx.message.chat.id, `Document submitted`);

    try { const files = ctx.update.message.document; } catch (err) { return; };
    
    var fileId = files.file_id; // Telegram stores various different sizes of the photos. "1" is a large one
    var fileName = files.file_name;
    var mimeType = files.mime_type;

    // Set the parent directory depending on the type of the file
    var parent_dir = "";
    if (mimeType.match(/^image/)) {
        parent_dir = await getSubDirectory("Photos");
    } else if (mimeType.match(/^video/)) {
        parent_dir = await getSubDirectory("Videos");
    } else { return; }

    // Get the file extension
    var extension = fileName.split(".")[1];

    // Get the current date information
    var ts = Date.now();
    var date_ob = new Date(ts);
    var day = date_ob.getDate();
    var month = date_ob.getMonth() + 1;
    var date = "39-" + month + "-" + day;

    // Use the file ID to call an axios http request to telegram's api to obtain the image
    try {
        ctx.telegram.getFileLink(fileId).then(downloadUrl => {
            axios({ url: downloadUrl.toString(), responseType: 'stream' }).then(response => {
                return new Promise((resolve, reject) => {

                    // Generate the file name and stream
                    var fileName = date + " (" + ctx.update.message.from.first_name + " @ " + ctx.update.message.chat.title + ")" + "." + extension;
                    var stream = response.data;

                    // Upload the file to google drive
                    uploadFile(fileName, stream, parent_dir);
                });
            }).catch();
        })
    } catch (err) { }
});

bot.on('video_note', async (ctx) => {
    if (DEBUG) ctx.telegram.sendMessage(ctx.message.chat.id, `Bubble submitted`);

    try { const files = ctx.update.message.video_note; } catch (err) { return; };
    var fileId = files.file_id; // Telegram stores various different sizes of the photos. "1" is a large one

    // Get the current date information
    var ts = Date.now();
    var date_ob = new Date(ts);
    var day = date_ob.getDate();
    var month = date_ob.getMonth() + 1;
    var date = "39-" + month + "-" + day;

    // Get the subdirectory ID
    var parent_dir = await getSubDirectory("Bubble Messages");

    // Use the file ID to call an axios http request to telegram's api to obtain the image
    try {
        ctx.telegram.getFileLink(fileId).then(downloadUrl => {
            axios({ url: downloadUrl.toString(), responseType: 'stream' }).then(response => {
                return new Promise((resolve, reject) => {

                    // Generate the file name and stream
                    var fileName = date + " (" + ctx.update.message.from.first_name + " @ " + ctx.update.message.chat.title + ")" + ".mp4";
                    var stream = response.data;

                    // Upload the file to google drive
                    uploadFile(fileName, stream, parent_dir);
                });
            })
        })
    } catch (err) { }
});

/*****************************************************
 * Directory Control
 ******************************************************/

// Create a folder if one doesn't already exist with a given name and parent
async function findOrCreateFolder(folderName, parent) {

    // Obtain user credentials to use for the request
    const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_KEYFILE,
        scopes: 'https://www.googleapis.com/auth/drive',
    });

    google.options({ auth });

    // Use the root folder as the parent if the "parent" parameter isn't set
    var parent_id = folderId;
    if (typeof parent !== "undefined") {
        parent_id = parent;
    }
    
    // Search to find the root ID of the folder
    var root_folder;
    try {

        // Search for the folder using the API
        const res = await drive.files.list({

            // For the query: Type = folder, and parent and name are matched
            q: "'" + parent_id + "' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '" + folderName + "'",
            
            // Idk what these do but hey it works
            fields: 'nextPageToken, files(id, name)',
            spaces: 'drive',
            supportsAllDrives: true,
            supportsTeamDrives: true,
        });

        root_folder = res.data.files[0].id;
    } catch (err) {
        
        // Folder didn't exist so make it
        root_folder = await createFolder(folderName, parent_id);
        return root_folder;
        
    }
    
    return root_folder;
}

// Create a folder with a given name
async function createFolder(folderName, parent_dir) {
    // Get credentials and build service
    // TODO (developer) - Use appropriate auth mechanism for your app

    // Obtain user credentials to use for the request
    const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_KEYFILE,
        scopes: 'https://www.googleapis.com/auth/drive',
    });

    google.options({ auth });

    const fileMetadata = {
        'name': folderName,
        'mimeType': 'application/vnd.google-apps.folder',
        parents: [parent_dir]
    };

    // Create the folder using the API
    try {
        const file = await drive.files.create({
            resource: fileMetadata,
            fields: 'id',
        });
        return file.data.id;
    } catch (err) {
        // TODO(developer) - Handle error
        throw err;
    }

}

// Get the month's folder ID
async function getRootDirectory() {
    // Get the name of the current month (probably a better way to do this but meh)
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const d = new Date();
    const month = monthNames[d.getMonth()];
    const year = d.getYear() + 17 - 100;

    // Get the root directory
    var root_folder = await findOrCreateFolder(month + " S" + year);
    return root_folder
}

// Get a folder ID within the month's directory
async function getSubDirectory(folder_name) {

    // Get the root directory for the month
    var root_folder = await getRootDirectory();

    // Get the folder within that root directory
    var subdir_folder = await findOrCreateFolder(folder_name, root_folder);
    return subdir_folder;
}

// Upload a file to the given location
async function uploadFile(filename, stream, parent_dir) {
    // Obtain user credentials to use for the request
    const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_KEYFILE,
        scopes: 'https://www.googleapis.com/auth/drive',
    });

    google.options({ auth });
    
    const resource = {
        name: filename,
        parents: [parent_dir]
    }

    // Create the file using the API
    const res = await drive.files.create(
        {   
            resource,
            media: {
                body: stream,
            },
            supportsAllDrives: true,
            supportsTeamDrives: true,
        }
    );
    
    if (DEBUG) console.log(res.data);
    return res.data;
}

// Launch the bot
bot.launch();

var http = require('http');
var server_port =  process.env.PORT;
var server_host = '0.0.0.0';
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('\n');
}).listen(server_port, server_host);